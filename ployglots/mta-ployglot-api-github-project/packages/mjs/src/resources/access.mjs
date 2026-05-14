import {
  LIST_COLLABORATORS,
  GET_BASE_ROLE,
  UPDATE_COLLABORATORS,
  UPDATE_BASE_ROLE,
  RESOLVE_USER,
  RESOLVE_TEAM,
} from '../graphql/access.mjs';
import { paginate } from '../client/paginate.mjs';
import { ValidationError } from '../client/errors.mjs';

const VALID_ROLES = ['NONE', 'READ', 'WRITE', 'ADMIN'];

function shapeCollab(node) {
  const a = node.actor;
  return {
    login: a.__typename === 'Team' ? a.combinedSlug : a.login,
    type: a.__typename === 'Team' ? 'TEAM' : 'USER',
    role: node.role,
    id: a.id,
  };
}

function assertRole(role) {
  if (!VALID_ROLES.includes(role)) {
    throw new ValidationError(`role must be one of ${VALID_ROLES.join(', ')}`);
  }
}

export function makeAccess(client) {
  const actorCache = new Map();

  async function resolveActorId({ login, type }) {
    const key = `${type}:${login}`;
    if (actorCache.has(key)) return actorCache.get(key);
    let id;
    if (type === 'USER') {
      const data = await client.graphql(RESOLVE_USER, { login });
      id = data?.user?.id;
    } else if (type === 'TEAM') {
      const [org, slug] = login.split('/');
      if (!org || !slug) throw new Error(`team login must be 'org/slug', got '${login}'`);
      const data = await client.graphql(RESOLVE_TEAM, { org, slug });
      id = data?.organization?.team?.id;
    } else {
      throw new Error(`unknown type ${type}`);
    }
    if (!id) throw new Error(`${type} ${login} not found`);
    actorCache.set(key, id);
    return id;
  }

  async function listCollaborators(projectId) {
    const out = [];
    for await (const node of paginate(client, {
      query: LIST_COLLABORATORS, variables: { projectId }, path: 'node.collaborators',
    })) out.push(shapeCollab(node));
    return out;
  }

  async function getBaseRole(projectId) {
    const data = await client.graphql(GET_BASE_ROLE, { projectId });
    return data?.node?.baseRole ?? null;
  }

  async function _setRole(projectId, { login, type, role }) {
    assertRole(role);
    const id = await resolveActorId({ login, type });
    const input = { projectId, collaborators: [{ [type === 'USER' ? 'userId' : 'teamId']: id, role }] };
    const data = await client.graphql(UPDATE_COLLABORATORS, { input });
    return data.updateProjectV2Collaborators.collaborators.nodes.map(shapeCollab);
  }

  async function addCollaborator(projectId, c)        { return _setRole(projectId, c); }
  async function updateCollaboratorRole(projectId, c) { return _setRole(projectId, c); }

  async function removeCollaborator(projectId, { login, type }) {
    return _setRole(projectId, { login, type, role: 'NONE' });
  }

  async function setBaseRole(projectId, role) {
    assertRole(role);
    await client.graphql(UPDATE_BASE_ROLE, { projectId, role });
    return role;
  }

  return {
    listCollaborators, getBaseRole,
    addCollaborator, updateCollaboratorRole, removeCollaborator, setBaseRole,
  };
}

export { shapeCollab };
