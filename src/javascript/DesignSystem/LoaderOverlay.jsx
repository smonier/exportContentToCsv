import React from 'react';
import PropTypes from 'prop-types';
import {Loader} from '@jahia/moonstone';

export const LoaderOverlay = ({isVisible}) => (
    <div
        className="flexFluid flexCol_center alignCenter"
        style={{
            backgroundColor: 'var(--color-light)',
            display: isVisible ? 'block' : 'none'
        }}
    >
        <Loader size="big"/>
    </div>
);

// Define propTypes for the component
LoaderOverlay.propTypes = {
    isVisible: PropTypes.bool.isRequired // Validate 'isVisible' as a required boolean
};
