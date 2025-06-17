const isDebugEnabled = process.env.NODE_ENV !== 'production';

const debug = (...args) => {
    if (isDebugEnabled) {
        if (window?.jahia?.log?.debug && window.jahia.log.debug !== debug) {
            window.jahia.log.debug(...args);
        } else if (console.debug) {
            console.debug(...args);
        } else {
            console.log(...args);
        }
    }
};

const info = (...args) => {
    if (window?.jahia?.log?.info && window.jahia.log.info !== info) {
        window.jahia.log.info(...args);
    } else if (console.info) {
        console.info(...args);
    } else {
        console.log(...args);
    }
};

const error = (...args) => {
    if (window?.jahia?.log?.error && window.jahia.log.error !== error) {
        window.jahia.log.error(...args);
    } else {
        console.error(...args);
    }
};

window.jahia = window.jahia || {};
window.jahia.log = window.jahia.log || {};
window.jahia.log.debug = window.jahia.log.debug || debug;
window.jahia.log.info = window.jahia.log.info || info;
window.jahia.log.error = window.jahia.log.error || error;

export default {debug, info, error};
