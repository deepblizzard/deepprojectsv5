'use server';

import { db } from '@/lib/prisma';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function createSprint(projectId, data) {
  const { userId } = auth();

  if (!userId) throw new Error('Unauthorized');

  // Get project
  const project = await db.project.findUnique({
    where: { id: projectId },
  });
  if (!project) throw new Error('Project not found');

  const orgId = project.organizationId;

  // Check if user is admin
  const memberships =
    await clerkClient().organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });
  const membership = memberships.data.find(
    (m) => m.publicUserData.userId === userId
  );
  if (!membership)
    throw new Error('User not associated with this organization');

  const adminRoles = ['admin', 'org:admin', 'owner', 'org:owner'];
  if (!adminRoles.includes(membership.role.toLowerCase())) {
    throw new Error('Only Admin can create a sprint');
  }

  // Create sprint
  const sprint = await db.sprint.create({
    data: {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'PLANNED',
      projectId: projectId,
    },
  });

  return sprint;
}

export async function updateSprintStatus(sprintId, newStatus) {
  const { userId } = auth();

  if (!userId) throw new Error('Unauthorized');

  const sprint = await db.sprint.findUnique({
    where: { id: sprintId },
    include: { project: true },
  });
  if (!sprint) throw new Error('Sprint not found');

  const orgId = sprint.project.organizationId;

  // Check admin membership
  const memberships =
    await clerkClient().organizations.getOrganizationMembershipList({
      organizationId: orgId,
    });
  const membership = memberships.data.find(
    (m) => m.publicUserData.userId === userId
  );
  if (!membership)
    throw new Error('User not associated with this organization');

  const adminRoles = ['admin', 'org:admin', 'owner', 'org:owner'];
  if (!adminRoles.includes(membership.role.toLowerCase())) {
    throw new Error('Only Admin can make this change');
  }

  const now = new Date();
  const startDate = new Date(sprint.startDate);
  const endDate = new Date(sprint.endDate);

  if (newStatus === 'ACTIVE' && (now < startDate || now > endDate)) {
    throw new Error('Cannot start sprint outside of its date range');
  }

  if (newStatus === 'COMPLETED' && sprint.status !== 'ACTIVE') {
    throw new Error('Can only complete an active sprint');
  }

  const updatedSprint = await db.sprint.update({
    where: { id: sprintId },
    data: { status: newStatus },
  });

  return { success: true, sprint: updatedSprint };
}
