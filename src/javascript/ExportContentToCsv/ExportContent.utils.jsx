import React from 'react';
import {ImgWrapper} from '@jahia/moonstone';

export const extractAndFormatContentTypeData = data => {
    const contentTypeSelectData = data.jcr.nodeTypes.nodes.map(item => {
        return {
            label: item.displayName,
            value: item.name,

            iconStart: <ImgWrapper src={item.icon + '.png'}/>
        };
    });

    contentTypeSelectData.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

    return contentTypeSelectData;
};

export const exportCSVFile = (data, filename, headers, csvSeparator) => {
    // Construct the CSV header row
    const csvHeaderRow = headers.join(csvSeparator);

    // Map the data to CSV rows
    const csvRows = data.map(row =>
        headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(csvSeparator));

    // Combine headers and rows
    const csvContent = [csvHeaderRow, ...csvRows].join('\n');

    // Trigger the CSV download
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

export const exportJSONFile = (data, filename) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], {type: 'application/json;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const sanitizeContentNodes = nodes => nodes.map(node => {
    const sanitized = {
        uuid: node.uuid,
        path: node.path,
        name: node.name,
        primaryNodeType: node.primaryNodeType?.name
    };

    const properties = {};
    if (Array.isArray(node.properties)) {
        node.properties.forEach(prop => {
            properties[prop.name] = prop.definition?.multiple ? prop.values : prop.value;
        });
    }

    const tagValues = node.tagList?.[0]?.values || node.tagList?.values;
    if (tagValues) {
        properties['j:tagList'] = tagValues;
    }

    if (node.categoryList?.categories) {
        properties['j:defaultCategory'] = node.categoryList.categories.map(c => c.name);
    }

    if (node.interests?.values) {
        properties['wem:interests'] = node.interests.values;
    }

    sanitized.properties = properties;

    return sanitized;
});
