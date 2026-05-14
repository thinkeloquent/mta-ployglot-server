import {
  GET_PROJECT_BY_OWNER_NUMBER,
  GET_PROJECT_BY_ID,
  LIST_ORG_PROJECTS,
  LIST_USER_PROJECTS,
  CREATE_PROJECT,
  UPDATE_PROJECT,
  DELETE_PROJECT,
} from '../graphql/projects.mjs';
import { GitHubGraphQLError, ValidationError } from '../client/errors.mjs';
import { paginate } from '../client/paginate.mjs';

const UPDATABLE = ['title', 'shortDescription', 'readme', 'public', 'closed'];

export function makeProjects(client) {
  async function get({ owner, number }) {
    const data = await client.graphql(GET_PROJECT_BY_OWNER_NUMBER, { owner, number });
    const proj = data?.organization?.projectV2 ?? data?.user?.projectV2;
    if (!proj) throw new GitHubGraphQLError('project not found', { errors: [{ type: 'NOT_FOUND', message: `${owner}#${number}` }] });
    return proj;
  }

  async function getById(id) {
    const data = await client.graphql(GET_PROJECT_BY_ID, { id });
    const proj = data?.node;
    if (!proj) throw new GitHubGraphQLError('project not found', { errors: [{ type: 'NOT_FOUND', message: id }] });
    return proj;
  }

  function list({ owner, scope }) {
    if (scope !== 'org' && scope !== 'user') {
      throw new Error("scope must be 'org' or 'user'");
    }
    const query = scope === 'org' ? LIST_ORG_PROJECTS : LIST_USER_PROJECTS;
    const path = scope === 'org' ? 'organization.projectsV2' : 'user.projectsV2';
    return paginate(client, { query, variables: { owner }, path });
  }

  async function create({ ownerId, title, repositoryId }) {
    if (!ownerId || !title) throw new Error('ownerId and title required');
    const input = { ownerId, title, ...(repositoryId ? { repositoryId } : {}) };
    const data = await client.graphql(CREATE_PROJECT, { input });
    return data.createProjectV2.projectV2;
  }

  async function update(id, fields) {
    const input = { projectId: id };
    for (const k of UPDATABLE) if (k in fields) input[k] = fields[k];
    if (Object.keys(input).length === 1) throw new ValidationError('no fields to update');
    const data = await client.graphql(UPDATE_PROJECT, { input });
    return data.updateProjectV2.projectV2;
  }

  async function close(id) { return update(id, { closed: true }); }
  async function reopen(id) { return update(id, { closed: false }); }

  async function deleteProject(id) {
    const data = await client.graphql(DELETE_PROJECT, { id });
    return data.deleteProjectV2.projectV2;
  }

  return { get, getById, list, create, update, close, reopen, delete: deleteProject };
}
