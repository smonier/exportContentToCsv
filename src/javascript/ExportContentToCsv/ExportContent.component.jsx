import React, {useEffect, useState} from 'react';
import {useLazyQuery} from '@apollo/client';
import {GetContentTypeQuery, GetContentPropertiesQuery, FetchContentForCSVQuery} from '~/gql-queries/ExportContent.gql-queries';
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
    const [csvSeparator, setCsvSeparator] = useState(','); // State for the CSV separator

    const siteKey = window.contextJsParameters.siteKey;
    const language = window.contextJsParameters.uilang;
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
        setSelectedProperties([]); // Clear selected properties when content type changes
        fetchProperties({variables: {type: selectedType, language}});
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
                workspace: workspace,
                properties: selectedProperties
            }
        })
            .then(response => {
                const descendants = response.data.jcr.result.descendants.nodes;

                const extractedData = descendants.map(node => {
                    const nodeData = {};
                    selectedProperties.forEach(property => {
                        const prop = node.properties.find(p => p.name === property);
                        nodeData[property] = prop ? prop.value : null;
                    });
                    return nodeData;
                });

                const csvHeaders = selectedProperties;
                // Generate dynamic filename with content type and timestamp
                const timestamp = new Date().toISOString().replace(/[:.-]/g, '_'); // Format the timestamp
                const filename = `${selectedContentType}_${timestamp}`; // Example: Article_2024_11_22T10_30_45

                // Trigger CSV download
                exportCSVFile(extractedData, filename, csvHeaders, csvSeparator);
            })
            .catch(err => {
                console.error('Error fetching content for CSV:', err);
            })
            .finally(() => {
                setIsExporting(false);
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
                    <div className={styles.separatorInput}>
                        <Typography variant="heading" className={styles.heading}>
                            {t('label.separator')}
                        </Typography>
                        <Dropdown
                            data={[
                                {label: ';', value: ';'},
                                {label: ',', value: ','},
                                {label: '#', value: '#'},
                                {label: '|', value: '|'},
                                {label: '/', value: '/'}
                            ]}
                            value={csvSeparator}
                            placeholder={t('label.separatorPlaceholder')}
                            className={styles.customDropdown}
                            onChange={(e, item) => setCsvSeparator(item.value)}
                        />
                    </div>
                </div>

                <div className={styles.rightPanel}>
                    <Typography variant="heading" className={styles.heading}>
                        {t('label.selectProperties')}
                    </Typography>
                    <div className={styles.scrollableProperties}>
                        {propertiesLoading ? (
                            <div>{t('label.loadingProperties')}</div>
                        ) : properties.length > 0 ? (
                            <>
                                {/* Select All Checkbox */}
                                <div className={styles.propertyItem}>
                                    <input
                                        type="checkbox"
                                        id="selectAll"
                                        checked={selectedProperties.length === properties.length}
                                        onChange={() => {
                                            if (selectedProperties.length === properties.length) {
                                                // Deselect all
                                                setSelectedProperties([]);
                                            } else {
                                                // Select all
                                                setSelectedProperties(properties.map(property => property.name));
                                            }
                                        }}
                                    />
                                    <label htmlFor="selectAll">{t('label.selectAll')}</label>
                                </div>
                                <hr className={styles.separatorLine}/>

                                {/* Render Sorted Properties */}
                                {properties
                                    .slice() // Create a shallow copy to avoid mutating the original array
                                    .sort((a, b) => a.displayName.localeCompare(b.displayName)) // Sort by displayName
                                    .map(property => (
                                        <div key={property.name} className={styles.propertyItem}>
                                            <input
                                                type="checkbox"
                                                id={property.name}
                                                checked={selectedProperties.includes(property.name)}
                                                onChange={() => handlePropertyToggle(property.name)}
                                            />
                                            <label htmlFor={property.name}>{property.displayName}</label>
                                        </div>
                                    ))}
                            </>
                        ) : (
                            <div>{t('label.noProperties')}</div>
                        )}
                    </div>
                </div>
            </div>

        </>
    );
};
