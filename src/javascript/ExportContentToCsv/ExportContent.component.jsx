import React, {useEffect, useState} from 'react';
import {useLazyQuery} from '@apollo/client';
import {GetContentTypeQuery, GetContentPropertiesQuery, FetchContentForCSVQuery} from './ExportContent.gql-queries.js';
import {Button, Header, Dropdown, Typography} from '@jahia/moonstone';
import styles from './ExportContent.component.scss';
import {useTranslation} from 'react-i18next';
import {exportCSVFile} from './ExportContent.utils';
import {extractAndFormatContentTypeData} from '~/ExportContentToCsv/ExportContent.utils';

export default () => {
    const {t} = useTranslation('exportContentToCsv');
    const [selectedContentType, setSelectedContentType] = useState(null);
    const [selectedProperties, setSelectedProperties] = useState([]);
    const [contentTypes, setContentTypes] = useState([]);
    const [properties, setProperties] = useState([]);
    const [isExporting, setIsExporting] = useState(false);

    const siteKey = window.contextJsParameters.siteKey;
    const language = window.contextJsParameters.language;
    const sitePath = '/sites/' + siteKey;
    const workspace = window.contextJsParameters.workspace === 'default' ? 'EDIT' : 'LIVE';

    // Fetch all content types
    const [fetchContentTypes, {data: contentTypeData, loading: contentTypeLoading}] = useLazyQuery(GetContentTypeQuery, {
        variables: {siteKey, language},
        fetchPolicy: 'network-only'
    });

    // Fetch properties of the selected content type
    const [fetchProperties, {data: propertiesData, loading: propertiesLoading}] = useLazyQuery(GetContentPropertiesQuery, {
        fetchPolicy: 'network-only'
    });

    // Fetch content based on the selected type and properties
    const [fetchContentForCSV] = useLazyQuery(FetchContentForCSVQuery, {
        fetchPolicy: 'network-only'
    });

    useEffect(() => {
        fetchContentTypes();
    }, [fetchContentTypes]);

    useEffect(() => {
        if (contentTypeData?.jcr?.nodeTypes?.nodes) {
            const contentTypeDataFormated = extractAndFormatContentTypeData(contentTypeData);

            setContentTypes(contentTypeDataFormated);
        }
    }, [contentTypeData]);

    useEffect(() => {
        if (propertiesData?.jcr?.nodeTypes?.nodes?.[0]?.properties) {
            setProperties(propertiesData.jcr.nodeTypes.nodes[0].properties);
        }
    }, [propertiesData]);

    const handleContentTypeChange = selectedType => {
        setSelectedContentType(selectedType);
        fetchProperties({variables: {type: selectedType}});
    };

    const handlePropertyToggle = propertyName => {
        setSelectedProperties(prev =>
            prev.includes(propertyName) ?
                prev.filter(prop => prop !== propertyName) :
                [...prev, propertyName]
        );
    };

    const handleExport = () => {
        setIsExporting(true);
        fetchContentForCSV({
            variables: {
                path: sitePath,
                language,
                type: selectedContentType,
                workspace: workspace, // You can change this to 'LIVE' if needed
                properties: selectedProperties // Pass selected properties
            }
        })
            .then(response => {
                const descendants = response.data.jcr.result.descendants.nodes;

                // Extract selected properties and include them in the header
                const extractedData = descendants.map(node => {
                    const nodeData = {};
                    selectedProperties.forEach(property => {
                        const prop = node.properties.find(p => p.name === property);
                        nodeData[property] = prop ? prop.value : null;
                    });
                    return nodeData;
                });

                // Generate CSV headers based on selected properties
                const csvHeaders = selectedProperties;

                // Trigger CSV download
                exportCSVFile(extractedData, 'exported_content', csvHeaders);
            })
            .catch(err => {
                console.error('Error fetching content for CSV:', err);
            })
            .finally(() => {
                setIsExporting(false); // Reset exporting state
            });
    };

    if (contentTypeLoading) {
        return <div>{t('label.loadingContentTypes')}</div>;
    }

    return (
        <>
            <Header
                title={t('label.header', {siteInfo: siteKey})}
                mainActions={[
                    <Button
                        key="exportButton"
                        size="big"
                        id="exportButton"
                        color="accent"
                        isDisabled={!selectedContentType || selectedProperties.length === 0 || isExporting}
                        label={isExporting ? t('label.exporting') : t('label.exportToCSV')}
                        onClick={isExporting ? null : handleExport}
                    />
                ]}
            />
            <div className={styles.container}>
                <div className={styles.leftPanel}>
                    <Typography variant="heading" className={styles.heading}>
                        {t('label.selectContentType')}
                    </Typography>
                    <Dropdown
                        data={contentTypes}
                        icon={contentTypes && contentTypes.iconStart}
                        label={contentTypes && contentTypes.label}
                        value={selectedContentType}
                        className={styles.customDropdown}
                        placeholder={t('label.selectPlaceholder')}
                        onChange={(e, item) => handleContentTypeChange(item.value)}
                    />
                </div>

                <div className={styles.rightPanel}>
                    <Typography variant="heading" className={styles.heading}>
                        {t('label.selectProperties')}
                    </Typography>
                    <div className={styles.scrollableProperties}>
                        {propertiesLoading ? (
                            <div>{t('label.loadingProperties')}</div>
                        ) : properties.length > 0 ? (
                            properties.map(property => (
                                <div key={property.name} className={styles.propertyItem}>
                                    <input
                                        type="checkbox"
                                        id={property.name}
                                        checked={selectedProperties.includes(property.name)}
                                        onChange={() => handlePropertyToggle(property.name)}
                                    />
                                    <label htmlFor={property.name}>{property.name}</label>
                                </div>
                            ))
                        ) : (
                            <div>{t('label.noProperties')}</div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
