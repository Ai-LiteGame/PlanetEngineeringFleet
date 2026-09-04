import { REGIONS } from './regions.js';

const tierForOrdinal = (ordinal) => (ordinal <= 30 ? 1 : ordinal <= 60 ? 2 : 3);

const projectId = (ordinal) => `project-${String(ordinal).padStart(3, '0')}`;

export const PROJECTS = Object.freeze(REGIONS.flatMap((region) => (
  region.projectTitles.map((title, index) => {
    const ordinal = (REGIONS.indexOf(region) * region.projectTitles.length) + index + 1;
    const tier = tierForOrdinal(ordinal);
    return Object.freeze({
      id: projectId(ordinal),
      ordinal,
      tier,
      stage: tier,
      regionId: region.id,
      title,
      vehicle: region.vehicles[index % region.vehicles.length],
      outcome: `完成${title}`,
    });
  })
)));

export function getProject(projectIdValue) {
  return PROJECTS.find((project) => project.id === projectIdValue) ?? null;
}
