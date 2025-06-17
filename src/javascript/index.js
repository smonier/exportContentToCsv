// Used only if jahia-ui-root is the host, experimental

import log from './log';

import('@jahia/app-shell/bootstrap').then(res => {
    log.debug(res);
    window.jahia = res;
    res.startAppShell(window.appShell.remotes, window.appShell.targetId);
});
