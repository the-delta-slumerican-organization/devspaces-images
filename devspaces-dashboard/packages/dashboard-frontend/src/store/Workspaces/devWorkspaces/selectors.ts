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

import { createSelector } from 'reselect';
import { AppState } from '../..';
import { DevWorkspaceStatus } from '../../../services/helpers/types';
import { selectRunningWorkspacesLimit } from '../../ClusterConfig/selectors';

const selectState = (state: AppState) => state.devWorkspaces;
export const selectDevWorkspacesState = selectState;

export const selectDevWorkspacesResourceVersion = createSelector(selectState, state => {
  return state.resourceVersion;
});

export const selectAllDevWorkspaces = createSelector(selectState, state => {
  return state.workspaces;
});

export const selectDevWorkspacesError = createSelector(selectState, state => state.error);

export const selectRunningDevWorkspaces = createSelector(selectState, state => {
  return state.workspaces.filter(
    workspace =>
      workspace.status?.phase === DevWorkspaceStatus.STARTING ||
      workspace.status?.phase === DevWorkspaceStatus.RUNNING,
  );
});

export const selectRunningDevWorkspacesLimitExceeded = createSelector(
  selectRunningDevWorkspaces,
  selectRunningWorkspacesLimit,
  (runningDevWorkspaces, runningWorkspacesLimit) =>
    runningDevWorkspaces.length >= runningWorkspacesLimit,
);
