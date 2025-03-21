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

import React from 'react';
import { Label } from '@patternfly/react-core';

import styles from './index.module.css';

type Props = {
  version: string;
};

class TagLabel extends React.PureComponent<Props> {
  public render(): React.ReactElement {
    const { version } = this.props;

    return (
      <Label className={styles.versionLabel} variant="outline" color="blue">
        {version}
      </Label>
    );
  }
}

export default TagLabel;
