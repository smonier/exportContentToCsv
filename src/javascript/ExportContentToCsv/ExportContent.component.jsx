import React, {useEffect, useState} from 'react';
import {useLazyQuery} from '@apollo/client';
import {GetContentTypeQuery, GetContentPropertiesQuery, FetchContentForExportQuery} from '~/gql-queries/ExportContent.gql-queries';
import {Button, Header, Dropdown, Typography} from '@jahia/moonstone';
import styles from './ExportContent.component.scss';
import {useTranslation} from 'react-i18next';
import {exportCSVFile, exportJSONFile} from './ExportContent.utils';
import {extractAndFormatContentTypeData} from '~/ExportContentToCsv/ExportContent.utils';
import log from '~/log';

export default () => {
    const {t} = useTranslation('exportContentToCsv');
    const [selectedContentType, setSelectedContentType] = useState(null);
    const [selectedProperties, setSelectedProperties] = useState([]);
    const [contentTypes, setContentTypes] = useState([]);
    const [properties, setProperties] = useState([]);
    const [isExporting, setIsExporting] = useState(false);
    const [csvSeparator, setCsvSeparator] = useState(','); // State for the CSV separator
    const [exportFormat, setExportFormat] = useState('csv');

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
    const [fetchContent] = useLazyQuery(FetchContentForExportQuery, {
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

    const notify = (type, message) => {
        if (window?.jahia?.ui?.notify) {
            window.jahia.ui.notify(type, null, message);
        } else {
            alert(message);
        }
    };

    const buildTree = (rootNode, nodes) => {
        const map = {};
        [...nodes, rootNode].forEach(n => {
            map[n.path] = {...n, children: []};
        });
        Object.values(map).forEach(n => {
            const parentPath = n.path.substring(0, n.path.lastIndexOf('/'));
            if (map[parentPath] && parentPath !== n.path) {
                map[parentPath].children.push(n);
            }
        });
        return map[rootNode.path];
    };

    const handleExport = () => {
        setIsExporting(true);
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
        const filename = `${selectedContentType}_${timestamp}`;

        if (exportFormat === 'csv') {
            fetchContent({
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
                        const nodeData = {
                            uuid: node.uuid,
                            path: node.path,
                            name: node.name,
                            primaryNodeType: node.primaryNodeType?.name,
                            displayName: node.displayName
                        };
                        selectedProperties.forEach(property => {
                            const prop = node.properties.find(p => p.name === property);
                            if (prop) {
                                nodeData[property] = prop.definition?.multiple ? prop.values : prop.value;
                            } else {
                                nodeData[property] = null;
                            }
                        });

                        nodeData['j:tagList'] = node.tagList?.[0]?.values || null;
                        nodeData['j:defaultCategory'] = node.categoryList?.categories?.map(c => c.name) || null;
                        nodeData.interests = node.interests?.values || null;

                        return nodeData;
                    });

                    const csvHeaders = ['uuid', 'path', 'name', 'primaryNodeType', 'displayName', ...selectedProperties, 'j:tagList', 'j:defaultCategory', 'interests'];

                    exportCSVFile(extractedData, filename, csvHeaders, csvSeparator);
                    notify('success', `${filename}.csv`);
                })
                .catch(err => {
                    log.error('Error fetching content for CSV:', err);
                    notify('error', `${filename}.csv`);
                })
                .finally(() => {
                    setIsExporting(false);
                });
        } else {
            fetchContent({
                variables: {
                    path: sitePath,
                    language,
                    type: selectedContentType,
                    workspace: workspace,
                    properties: null
                }
            })
                .then(response => {
                    const rootNode = response.data.jcr.result;
                    const descendants = rootNode.descendants.nodes;
                    const tree = buildTree(rootNode, descendants);
                    exportJSONFile(tree, filename);
                    notify('success', `${filename}.json`);
                })
                .catch(err => {
                    log.error('Error fetching content for JSON:', err);
                    notify('error', `${filename}.json`);
                })
                .finally(() => {
                    setIsExporting(false);
                });
        }
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
                        isDisabled={!selectedContentType || (exportFormat === 'csv' && selectedProperties.length === 0) || isExporting}
                        label={isExporting ? t('label.exporting') : (exportFormat === 'csv' ? t('label.exportToCSV') : t('label.exportToJSON'))}
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
