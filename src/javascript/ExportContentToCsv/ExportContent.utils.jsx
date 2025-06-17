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
