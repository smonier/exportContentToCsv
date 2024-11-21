package org.jahia.se.modules.exporttocsv.services;

import org.jahia.utils.i18n.Messages;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.NodeIterator;
import javax.jcr.RepositoryException;
import javax.jcr.query.QueryResult;
import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component(service = ExportToCsvService.class, configurationPid = "org.jahia.se.modules.exporttocsv.config")
public class ExportToCsvService {

    private final static Logger LOGGER = LoggerFactory.getLogger(ExportToCsvService.class);

    private static Character CSV_SEPARATOR;

    @Activate
    public void activate(Map<String, String> config) {
        String separator = config.get("exportToCsv.separator");
        if (separator != null && !separator.isEmpty()) {
            CSV_SEPARATOR = separator.charAt(0); // Use the first character of the string
        } else {
            CSV_SEPARATOR = ';'; // Provide a default value if the configuration is missing
        }
    }

    public static void writeHeader(OutputStream outputStream, int maxLevels, String headerTitle, String levelTitle,
                                   List<String> columnsNames, Locale locale, String resourceBundle) throws IOException {
        StringBuilder line = new StringBuilder();

        // Write path levels part
        line.append(headerTitle);
        line.append(CSV_SEPARATOR);

        for (int i = 1; i < maxLevels; i++) {
            line.append(levelTitle);
            line.append(" ").append(i);
            line.append(CSV_SEPARATOR);
        }

        // Write column headers
        for (int i = 0; i < columnsNames.size(); i++) {
            line.append(Messages.get(resourceBundle, columnsNames.get(i), locale));
            if (i < columnsNames.size() - 1) {
                line.append(CSV_SEPARATOR);
            }
        }
        line.append("\n");
        outputStream.write(line.toString().getBytes());
    }


    public static int maxLevelsPath(QueryResult result) throws RepositoryException {
        NodeIterator nodes = result.getNodes();
        int maxLevels = 0;

        while (nodes.hasNext()) {
            String[] levels = nodes.nextNode().getPath().split("/");
            maxLevels = Math.max(maxLevels, levels.length);
        }
        return maxLevels;
    }
}