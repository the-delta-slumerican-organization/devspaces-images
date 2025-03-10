/*
 * Copyright (c) 2018-2021 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { Reducer } from 'redux';
import { AppThunk } from '..';
import { createObject } from '../helpers';
import devfileApi, { isDevfileV2, isDevWorkspace } from '../../services/devfileApi';
import { isCheWorkspace, Workspace } from '../../services/workspace-adapter';
import * as CheWorkspacesStore from './cheWorkspaces';
import * as DevWorkspacesStore from './devWorkspaces';
import { isDevworkspacesEnabled } from '../../services/helpers/devworkspace';
import common from '@eclipse-che/common';
import OAuthService, { isOAuthResponse } from '../../services/oauth';

// This state defines the type of data maintained in the Redux store.
export interface State {
  isLoading: boolean;

  // current workspace qualified name
  namespace: string;
  workspaceName: string;
  workspaceUID: string;
  // number of recent workspaces
  recentNumber: number;
}

interface RequestWorkspacesAction {
  type: 'REQUEST_WORKSPACES';
}

interface ReceiveErrorAction {
  type: 'RECEIVE_ERROR';
}

interface ReceiveWorkspacesAction {
  type: 'RECEIVE_WORKSPACES';
}

interface UpdateWorkspaceAction {
  type: 'UPDATE_WORKSPACE';
}

interface DeleteWorkspaceLogsAction {
  type: 'DELETE_WORKSPACE_LOGS';
  workspace: Workspace;
}

interface DeleteWorkspaceAction {
  type: 'DELETE_WORKSPACE';
}

interface AddWorkspaceAction {
  type: 'ADD_WORKSPACE';
}

interface SetWorkspaceQualifiedName {
  type: 'SET_WORKSPACE_NAME';
  namespace: string;
  workspaceName: string;
}

interface ClearWorkspaceQualifiedName {
  type: 'CLEAR_WORKSPACE_NAME';
}

interface SetWorkspaceUID {
  type: 'SET_WORKSPACE_UID';
  workspaceUID: string;
}

interface ClearWorkspaceUID {
  type: 'CLEAR_WORKSPACE_UID';
}

type KnownAction =
  | RequestWorkspacesAction
  | ReceiveErrorAction
  | ReceiveWorkspacesAction
  | UpdateWorkspaceAction
  | DeleteWorkspaceAction
  | AddWorkspaceAction
  | SetWorkspaceQualifiedName
  | ClearWorkspaceQualifiedName
  | SetWorkspaceUID
  | ClearWorkspaceUID
  | DeleteWorkspaceLogsAction;

export type ResourceQueryParams = {
  'debug-workspace-start': boolean;
  [propName: string]: string | boolean | undefined;
};
export type ActionCreators = {
  requestWorkspaces: () => AppThunk<KnownAction, Promise<void>>;
  requestWorkspace: (workspace: Workspace) => AppThunk<KnownAction, Promise<void>>;
  startWorkspace: (
    workspace: Workspace,
    params?: ResourceQueryParams,
  ) => AppThunk<KnownAction, Promise<void>>;
  restartWorkspace: (workspace: Workspace) => AppThunk<KnownAction, Promise<void>>;
  stopWorkspace: (workspace: Workspace) => AppThunk<KnownAction, Promise<void>>;
  deleteWorkspace: (workspace: Workspace) => AppThunk<KnownAction, Promise<void>>;
  updateWorkspace: (workspace: Workspace) => AppThunk<KnownAction, Promise<void>>;
  createWorkspaceFromDevfile: (
    devfile: che.WorkspaceDevfile | devfileApi.Devfile,
    namespace: string | undefined,
    infrastructureNamespace: string | undefined,
    attributes: { [key: string]: string },
    optionalFilesContent?: {
      [fileName: string]: string;
    },
  ) => AppThunk<KnownAction, Promise<void>>;

  setWorkspaceQualifiedName: (
    namespace: string,
    workspaceName: string,
  ) => AppThunk<SetWorkspaceQualifiedName>;
  clearWorkspaceQualifiedName: () => AppThunk<ClearWorkspaceQualifiedName>;
  setWorkspaceUID: (workspaceUID: string) => AppThunk<SetWorkspaceUID>;
  clearWorkspaceUID: () => AppThunk<ClearWorkspaceUID>;
  deleteWorkspaceLogs: (workspace: Workspace) => AppThunk<DeleteWorkspaceLogsAction>;
};

export const actionCreators: ActionCreators = {
  requestWorkspaces:
    (): AppThunk<KnownAction, Promise<void>> =>
    async (dispatch): Promise<void> => {
      dispatch({ type: 'REQUEST_WORKSPACES' });
      try {
        const promises: Promise<unknown>[] = [
          dispatch(DevWorkspacesStore.actionCreators.requestWorkspaces()),
          dispatch(CheWorkspacesStore.actionCreators.requestWorkspaces()),
        ];

        await Promise.allSettled(promises);

        dispatch({ type: 'RECEIVE_WORKSPACES' });
      } catch (e) {
        dispatch({ type: 'RECEIVE_ERROR' });
        throw e;
      }
    },

  requestWorkspace:
    (workspace: Workspace): AppThunk<KnownAction, Promise<void>> =>
    async (dispatch, getState): Promise<void> => {
      dispatch({ type: 'REQUEST_WORKSPACES' });
      try {
        const state = getState();
        const cheDevworkspaceEnabled = isDevworkspacesEnabled(state.workspacesSettings.settings);

        if (cheDevworkspaceEnabled && isDevWorkspace(workspace.ref)) {
          await dispatch(DevWorkspacesStore.actionCreators.requestWorkspace(workspace.ref));
        } else {
          await dispatch(
            CheWorkspacesStore.actionCreators.requestWorkspace(workspace.ref as che.Workspace),
          );
        }
        dispatch({ type: 'UPDATE_WORKSPACE' });
      } catch (e) {
        dispatch({ type: 'RECEIVE_ERROR' });
        throw e;
      }
    },

  startWorkspace:
    (workspace: Workspace, params?: ResourceQueryParams): AppThunk<KnownAction, Promise<void>> =>
    async (dispatch, getState): Promise<void> => {
      dispatch({ type: 'REQUEST_WORKSPACES' });
      try {
        const state = getState();
        const cheDevworkspaceEnabled = isDevworkspacesEnabled(state.workspacesSettings.settings);
        await OAuthService.refreshTokenIfNeeded(workspace);

        if (cheDevworkspaceEnabled && isDevWorkspace(workspace.ref)) {
          const debugWorkspace = params && params['debug-workspace-start'];
          await dispatch(
            DevWorkspacesStore.actionCreators.startWorkspace(workspace.ref, debugWorkspace),
          );
        } else {
          await dispatch(
            CheWorkspacesStore.actionCreators.startWorkspace(
              workspace.ref as che.Workspace,
              params,
            ),
          );
        }
        dispatch({ type: 'UPDATE_WORKSPACE' });
      } catch (e) {
        if (common.helpers.errors.includesAxiosResponse(e)) {
          const response = e.response;
          if (response.status === 401 && isOAuthResponse(response.data)) {
            // build redirect URL
            const redirectUrl = new URL(
              'dashboard/w',
              window.location.protocol + '//' + window.location.host,
            );
            redirectUrl.searchParams.set(
              'params',
              `{"namespace":"${workspace.namespace}","workspace":"${workspace.name}"}`,
            );
            OAuthService.openOAuthPage(
              response.data.attributes.oauth_authentication_url,
              redirectUrl.toString(),
            );
            return;
          }
        }
        dispatch({ type: 'RECEIVE_ERROR' });
        throw e;
      }
    },

  restartWorkspace:
    (workspace: Workspace): AppThunk<KnownAction, Promise<void>> =>
    async (dispatch, getState): Promise<void> => {
      try {
        const state = getState();
        const cheDevworkspaceEnabled = isDevworkspacesEnabled(state.workspacesSettings.settings);
        if (cheDevworkspaceEnabled && isDevWorkspace(workspace.ref)) {
          await dispatch(DevWorkspacesStore.actionCreators.restartWorkspace(workspace.ref));
        } else {
          await dispatch(
            CheWorkspacesStore.actionCreators.restartWorkspace(workspace.ref as che.Workspace),
          );
        }
      } catch (e) {
        dispatch({ type: 'RECEIVE_ERROR' });
        throw e;
      }
    },

  stopWorkspace:
    (workspace: Workspace): AppThunk<KnownAction, Promise<void>> =>
    async (dispatch, getState): Promise<void> => {
      try {
        const state = getState();
        const cheDevworkspaceEnabled = isDevworkspacesEnabled(state.workspacesSettings.settings);
        if (cheDevworkspaceEnabled && isDevWorkspace(workspace.ref)) {
          await dispatch(DevWorkspacesStore.actionCreators.stopWorkspace(workspace.ref));
        } else {
          await dispatch(
            CheWorkspacesStore.actionCreators.stopWorkspace(workspace.ref as che.Workspace),
          );
        }
      } catch (e) {
        dispatch({ type: 'RECEIVE_ERROR' });
        throw e;
      }
    },

  deleteWorkspace:
    (workspace: Workspace): AppThunk<KnownAction, Promise<void>> =>
    async (dispatch, getState): Promise<void> => {
      try {
        const state = getState();
        const cheDevworkspaceEnabled = isDevworkspacesEnabled(state.workspacesSettings.settings);
        if (cheDevworkspaceEnabled && isDevWorkspace(workspace.ref)) {
          await dispatch(DevWorkspacesStore.actionCreators.terminateWorkspace(workspace.ref));
        } else {
          await dispatch(
            CheWorkspacesStore.actionCreators.deleteWorkspace(workspace.ref as che.Workspace),
          );
        }
      } catch (e) {
        dispatch({ type: 'RECEIVE_ERROR' });
        throw e;
      }
    },

  updateWorkspace:
    (workspace: Workspace): AppThunk<KnownAction, Promise<void>> =>
    async (dispatch): Promise<void> => {
      dispatch({ type: 'REQUEST_WORKSPACES' });
      try {
        if (isCheWorkspace(workspace.ref)) {
          await dispatch(
            CheWorkspacesStore.actionCreators.updateWorkspace(workspace.ref as che.Workspace),
          );
        } else {
          await dispatch(
            DevWorkspacesStore.actionCreators.updateWorkspace(
              workspace.ref as devfileApi.DevWorkspace,
            ),
          );
        }
        dispatch({ type: 'UPDATE_WORKSPACE' });
      } catch (e) {
        dispatch({ type: 'RECEIVE_ERROR' });
        throw e;
      }
    },

  createWorkspaceFromDevfile:
    (
      devfile: che.WorkspaceDevfile | devfileApi.Devfile,
      namespace: string | undefined,
      infrastructureNamespace: string | undefined,
      attributes: { [key: string]: string },
      optionalFilesContent?: {
        [fileName: string]: string;
      },
    ): AppThunk<KnownAction, Promise<void>> =>
    async (dispatch, getState): Promise<void> => {
      dispatch({ type: 'REQUEST_WORKSPACES' });
      try {
        const state = getState();

        const cheDevworkspaceEnabled = isDevworkspacesEnabled(state.workspacesSettings.settings);
        if (cheDevworkspaceEnabled && isDevfileV2(devfile)) {
          const pluginRegistryUrl =
            state.workspacesSettings.settings['cheWorkspacePluginRegistryUrl'];
          const pluginRegistryInternalUrl =
            state.workspacesSettings.settings['cheWorkspacePluginRegistryInternalUrl'];
          await dispatch(
            DevWorkspacesStore.actionCreators.createWorkspaceFromDevfile(
              devfile,
              optionalFilesContent || {},
              pluginRegistryUrl,
              pluginRegistryInternalUrl,
              attributes,
            ),
          );
          dispatch({ type: 'ADD_WORKSPACE' });
        } else {
          await dispatch(
            CheWorkspacesStore.actionCreators.createWorkspaceFromDevfile(
              devfile as che.WorkspaceDevfile,
              namespace,
              infrastructureNamespace,
              attributes,
            ),
          );
          dispatch({
            type: 'ADD_WORKSPACE',
          });
        }
      } catch (e) {
        dispatch({ type: 'RECEIVE_ERROR' });
        throw e;
      }
    },

  setWorkspaceQualifiedName:
    (namespace: string, workspaceName: string): AppThunk<SetWorkspaceQualifiedName> =>
    dispatch => {
      dispatch({
        type: 'SET_WORKSPACE_NAME',
        namespace,
        workspaceName,
      });
    },

  clearWorkspaceQualifiedName: (): AppThunk<ClearWorkspaceQualifiedName> => dispatch => {
    dispatch({ type: 'CLEAR_WORKSPACE_NAME' });
  },

  setWorkspaceUID:
    (workspaceUID: string): AppThunk<SetWorkspaceUID> =>
    dispatch => {
      dispatch({
        type: 'SET_WORKSPACE_UID',
        workspaceUID,
      });
    },

  clearWorkspaceUID: (): AppThunk<ClearWorkspaceUID> => dispatch => {
    dispatch({ type: 'CLEAR_WORKSPACE_UID' });
  },

  deleteWorkspaceLogs:
    (workspace: Workspace): AppThunk<KnownAction> =>
    (dispatch, getState): void => {
      const state = getState();
      const cheDevworkspaceEnabled = isDevworkspacesEnabled(state.workspacesSettings.settings);
      if (cheDevworkspaceEnabled) {
        dispatch(DevWorkspacesStore.actionCreators.deleteWorkspaceLogs(workspace.uid));
      } else {
        dispatch(CheWorkspacesStore.actionCreators.deleteWorkspaceLogs(workspace.uid));
      }
    },
};

const unloadedState: State = {
  isLoading: false,

  namespace: '',
  workspaceName: '',
  workspaceUID: '',

  recentNumber: 5,
};

export const reducer: Reducer<State> = (state: State | undefined, action: KnownAction): State => {
  if (state === undefined) {
    return unloadedState;
  }

  switch (action.type) {
    case 'REQUEST_WORKSPACES':
      return createObject(state, {
        isLoading: true,
      });
    case 'RECEIVE_ERROR':
    case 'UPDATE_WORKSPACE':
    case 'ADD_WORKSPACE':
    case 'DELETE_WORKSPACE':
    case 'RECEIVE_WORKSPACES':
      return createObject(state, {
        isLoading: false,
      });
    case 'SET_WORKSPACE_NAME':
      return createObject(state, {
        namespace: action.namespace,
        workspaceName: action.workspaceName,
      });
    case 'CLEAR_WORKSPACE_NAME':
      return createObject(state, {
        namespace: '',
        workspaceName: '',
      });
    case 'SET_WORKSPACE_UID':
      return createObject(state, {
        workspaceUID: action.workspaceUID,
      });
    case 'CLEAR_WORKSPACE_UID':
      return createObject(state, {
        workspaceUID: '',
      });
    default:
      return state;
  }
};
