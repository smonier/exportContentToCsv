import React, {useEffect, useState} from 'react';
import {useLazyQuery} from '@apollo/client';
import {GetContentTypeQuery, GetContentPropertiesQuery, FetchContentForExportQuery, GetSiteLanguagesQuery} from '~/gql-queries/ExportContent.gql-queries';
import {Button, Header, Dropdown, Typography} from '@jahia/moonstone';
import {Dialog, DialogActions, DialogContent, DialogTitle} from '@material-ui/core';

import styles from './ExportContent.component.scss';
import {useTranslation} from 'react-i18next';
import {exportCSVFile, exportJSONFile, sanitizeContentNodes} from './ExportContent.utils';
import {extractAndFormatContentTypeData} from '~/ExportContentToCsv/ExportContent.utils';
import log from '~/log';

export default () => {
    const {t} = useTranslation('exportContentToCsv');
    const [selectedContentType, setSelectedContentType] = useState(null);
    const [selectedProperties, setSelectedProperties] = useState([]);
    const [contentTypes, setContentTypes] = useState([]);
    const [properties, setProperties] = useState([]);
    const [languages, setLanguages] = useState([]);
    const [selectedLanguage, setSelectedLanguage] = useState(window.contextJsParameters.uilang);
    const [isExporting, setIsExporting] = useState(false);
    const [csvSeparator, setCsvSeparator] = useState(','); // State for the CSV separator
    const [exportFormat, setExportFormat] = useState('csv');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState('');
    const [pendingExport, setPendingExport] = useState(null);
    const [exportFilename, setExportFilename] = useState('');

    const siteKey = window.contextJsParameters.siteKey;
    const sitePath = '/sites/' + siteKey;
    const workspace = window.contextJsParameters.workspace === 'default' ? 'EDIT' : 'LIVE';

    // Fetch available languages for the site
    const [fetchSiteLanguages, {data: languagesData}] = useLazyQuery(GetSiteLanguagesQuery, {
        variables: {
            workspace: workspace,
            scope: sitePath
        },
        fetchPolicy: 'network-only',
        onError: error => {
            console.error('GetSiteLanguages error', error);
        }
    });

    // Fetch all content types
    const [fetchContentTypes, {data: contentTypeData, loading: contentTypeLoading}] = useLazyQuery(GetContentTypeQuery, {
        fetchPolicy: 'network-only'
    });

    // Fetch properties of the selected content type
    const [fetchProperties, {data: propertiesData, loading: propertiesLoading}] = useLazyQuery(GetContentPropertiesQuery, {
        fetchPolicy: 'network-only'
    });

    // Fetch content based on the selected type and properties
    const [fetchContentForExport] = useLazyQuery(FetchContentForExportQuery, {
        fetchPolicy: 'network-only'
    });

    useEffect(() => {
        fetchSiteLanguages();
    }, [fetchSiteLanguages]);

    useEffect(() => {
        fetchContentTypes({variables: {siteKey, language: selectedLanguage}});
    }, [fetchContentTypes, siteKey, selectedLanguage]);

    useEffect(() => {
        if (contentTypeData?.jcr?.nodeTypes?.nodes) {
            const contentTypeDataFormated = extractAndFormatContentTypeData(contentTypeData);

            setContentTypes(contentTypeDataFormated);
        }
    }, [contentTypeData]);

    useEffect(() => {
        if (languagesData?.jcr?.nodeByPath?.languages?.values) {
            const langs = languagesData.jcr.nodeByPath.languages.values.map(l => ({label: l, value: l}));
            setLanguages(langs);
        }
    }, [languagesData]);
    useEffect(() => {
        if (propertiesData?.jcr?.nodeTypes?.nodes?.[0]?.properties) {
            setProperties(propertiesData.jcr.nodeTypes.nodes[0].properties);
        }
    }, [propertiesData]);

    const handleContentTypeChange = selectedType => {
        setSelectedContentType(selectedType);
        setSelectedProperties([]); // Clear selected properties when content type changes
        fetchProperties({variables: {type: selectedType, language: selectedLanguage}});
    };

    const handlePropertyToggle = propertyName => {
        setSelectedProperties(prev =>
            prev.includes(propertyName) ?
                prev.filter(prop => prop !== propertyName) :
                [...prev, propertyName]
        );
    };

    const notify = (type, message) => {
        if (window?.jahia?.ui?.notify) {
            window.jahia.ui.notify(type, null, message);
        } else {
            // eslint-disable-next-line no-alert
            alert(message);
        }
    };

    const confirmDownload = () => {
        if (!pendingExport) {
            return;
        }

        if (pendingExport.type === 'csv') {
            exportCSVFile(pendingExport.data, exportFilename, pendingExport.headers, pendingExport.separator);
            notify('success', `${exportFilename}.csv`);
        } else {
            exportJSONFile(pendingExport.data, exportFilename);
            notify('success', `${exportFilename}.json`);
        }

        setIsPreviewOpen(false);
        setPreviewData('');
        setPendingExport(null);
    };

    const cancelPreview = () => {
        setIsPreviewOpen(false);
        setPreviewData('');
        setPendingExport(null);
    };

    const handleExport = () => {
        setIsExporting(true);
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
        const filename = `${selectedContentType}_${timestamp}`;
        setExportFilename(filename);

        fetchContentForExport({
            variables: {
                path: sitePath,
                language: selectedLanguage,
                type: selectedContentType,
                workspace: workspace,
                properties: selectedProperties
            }
        })
            .then(response => {
                const descendants = response.data.jcr.result.descendants.nodes;

                if (exportFormat === 'csv') {
                    const extractedData = descendants.map(node => {
                        const nodeData = {
                            uuid: node.uuid,
                            path: node.path,
                            name: node.name,
                            primaryNodeType: node.primaryNodeType?.name
                        };

                        selectedProperties.forEach(property => {
                            const prop = node.properties.find(p => p.name === property);
                            if (prop) {
                                nodeData[property] = prop.definition?.multiple ? prop.values : prop.value;
                            } else {
                                nodeData[property] = null;
                            }
                        });

                        const tagValues = node.tagList?.[0]?.values || node.tagList?.values;
                        nodeData['j:tagList'] = tagValues || null;

                        const categories = node.categoryList?.categories ? node.categoryList.categories.map(c => c.name) : null;
                        nodeData['j:defaultCategory'] = categories;

                        const interests = node.interests?.values || null;
                        nodeData['wem:interests'] = interests;

                        return nodeData;
                    });

                    const csvHeaders = [
                        'uuid',
                        'path',
                        'name',
                        'primaryNodeType',
                        ...selectedProperties,
                        'j:tagList',
                        'j:defaultCategory',
                        'wem:interests'
                    ];

                    const csvHeaderRow = csvHeaders.join(csvSeparator);
                    const csvRows = extractedData.map(row =>
                        csvHeaders.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(csvSeparator)
                    );
                    const csvContent = [csvHeaderRow, ...csvRows].join('\n');
                    setPendingExport({type: 'csv', data: extractedData, headers: csvHeaders, separator: csvSeparator});
                    setPreviewData(csvContent);
                    setIsPreviewOpen(true);
                } else {
                    const jsonData = sanitizeContentNodes(descendants);
                    setPendingExport({type: 'json', data: jsonData});
                    setPreviewData(JSON.stringify(jsonData, null, 2));
                    setIsPreviewOpen(true);
                }
            })
            .catch(err => {
                log.error('Error fetching content for export:', err);
                notify('error', `${filename}.${exportFormat}`);
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
            <Dialog
                open={isPreviewOpen}
                onClose={cancelPreview}
            >
                <DialogTitle>{t('label.previewTitle')}</DialogTitle>
                <DialogContent>
                    <pre style={{maxHeight: '400px', overflow: 'auto'}}>{previewData}</pre>
                </DialogContent>
                <DialogActions>
                    <Button label={t('label.previewCancel')} onClick={cancelPreview}/>
                    <Button label={t('label.previewDownload')} color="accent" onClick={confirmDownload}/>
                </DialogActions>
            </Dialog>
            <Header
                title={t('label.header', {siteInfo: siteKey})}
                mainActions={[
                    <Button
                        key="exportButton"
                        size="big"
                        id="exportButton"
                        color="accent"
                        isDisabled={!selectedContentType || (exportFormat === 'csv' && selectedProperties.length === 0) || isExporting}
                        label={isExporting ? t('label.exporting') : (exportFormat === 'csv' ? t('label.exportToCSV') : t('label.exportToJSON'))}
                        onClick={isExporting ? null : handleExport}
                    />
                ]}
            />
            <div className={styles.container}>
                <div className={styles.leftPanel}>
                    <Typography variant="heading" className={styles.heading}>
                        {t('label.selectLanguage')}
                    </Typography>
                    <Dropdown
                        data={languages}
                        value={selectedLanguage}
                        className={styles.customDropdown}
                        placeholder={t('label.selectPlaceholder')}
                        onChange={(e, item) => setSelectedLanguage(item.value)}
                    />
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
                            {t('label.exportFormat')}
                        </Typography>
                        <Dropdown
                            data={[{label: 'CSV', value: 'csv'}, {label: 'JSON', value: 'json'}]}
                            value={exportFormat}
                            className={styles.customDropdown}
                            onChange={(e, item) => setExportFormat(item.value)}
                        />
                    </div>
                    {exportFormat === 'csv' && (
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
                    )}
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
