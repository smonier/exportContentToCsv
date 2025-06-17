package org.jahia.se.modules.exporttocsv.actions;


import org.jahia.se.modules.exporttocsv.services.ExportToCsvService;
import org.osgi.service.component.annotations.Activate;
import org.osgi.service.component.annotations.Component;
import org.apache.jackrabbit.core.security.JahiaLoginModule;
import org.jahia.api.Constants;
import org.jahia.bin.Action;
import org.jahia.bin.ActionResult;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionFactory;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.render.RenderContext;
import org.jahia.services.render.Resource;
import org.jahia.services.render.URLResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.jcr.*;
import javax.jcr.query.Query;
import javax.jcr.query.QueryResult;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.OutputStream;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;


@Component(service = Action.class, immediate = true)
public class RequestExportToCsv extends Action {

    private static final Logger LOGGER = LoggerFactory.getLogger(RequestExportToCsv.class);
    private final static Character CSV_SEPARATOR = ';';

    @Activate
    public void activate() {
        setName("requestExportToCsv");
        setRequireAuthenticatedUser(true);
        setRequiredPermission("jcr:write_default");
        setRequiredWorkspace("default");
        setRequiredMethods("GET,POST");
    }

    @Override
    public ActionResult doExecute(final HttpServletRequest request,
                                  final RenderContext renderContext,
                                  final Resource resource,
                                  final JCRSessionWrapper session,
                                  Map<String, List<String>> parameters,
                                  final URLResolver urlResolver) throws Exception {

        LOGGER.debug("Enter RequestExportAsCsv class");
        LOGGER.debug("Current node URL : " + resource.getNode().getPath());

        DateFormat dateFormat = new SimpleDateFormat("dd-MM-yyyy_HH-mm-ss");
        Date date = new Date();

        HttpServletResponse response = renderContext.getResponse();
        response.setContentType("text/csv");
        response.setHeader("Content-Disposition","attachment;filename=contentExport_"+(dateFormat.format(date))+".csv");
        ActionResult actionResult;

        OutputStream outputStream = null;

        String contentTypeToExport = null;
        if (parameters.containsKey("contentTypeToExport") && !parameters.get("contentTypeToExport").isEmpty()) {
            contentTypeToExport = parameters.get("contentTypeToExport").get(0);
        }

        try {
            outputStream = response.getOutputStream();

            // First we get the nodes
            String stringQuery = constructStringQuery(contentTypeToExport, resource);
            LOGGER.debug("Query to export in CSV : " + stringQuery);

            JCRSessionWrapper rootSessionLive = null;

            try {
                rootSessionLive = JCRSessionFactory.getInstance().login(JahiaLoginModule.getSystemCredentials(), Constants.LIVE_WORKSPACE);
                Query query = rootSessionLive.getWorkspace().getQueryManager().createQuery(stringQuery, Query.JCR_SQL2);
                QueryResult result = query.execute();

                // then, if the result is not null, we write the corresponding informations into a csv
                if (result != null) {
                    // Create a list containing columns names
                    List<String> columnsNames = new LinkedList<>();
                    if (result.getNodes().hasNext()) {
                        Node firstNode = result.getNodes().nextNode();
                        PropertyIterator properties = firstNode.getProperties();
                        while (properties.hasNext()) {
                            columnsNames.add(properties.nextProperty().getName());
                        }
                    }
                    LOGGER.info("Exporting columns: " + columnsNames);
                    writeToCsv(result, outputStream, resource, columnsNames);
                } else {
                    LOGGER.debug("Result is null");
                }

                // If everything goes fine we send back a code 200
                actionResult = ActionResult.OK;

            } catch (RepositoryException e) {
                // Else we send back an error code 400
                LOGGER.error("Error while processing the nodes",e);
                actionResult = ActionResult.INTERNAL_ERROR;

            } finally {
                if(rootSessionLive != null) {
                    rootSessionLive.logout();
                    LOGGER.debug("Logged out from the root session");
                }
            }
        }
        catch (IOException e){
            // Else we send back an error code 400
            LOGGER.error("Error while writing the CSV to the outputStream",e);
            actionResult = ActionResult.INTERNAL_ERROR;

        } catch (Exception e) {
            // Else we send back an error code 400
            LOGGER.error("Can't open the csv outputStream",e);
            actionResult = ActionResult.INTERNAL_ERROR;
        }
        finally {
            // Finally we close the ouputStream
            if(outputStream != null){
                try {
                    outputStream.flush();
                    outputStream.close();
                } catch (IOException e) {
                    LOGGER.error("Could not clean the csv output stream");
                    LOGGER.error(e.getMessage());
                }
                LOGGER.debug("Stream closed");
            }
        }

        LOGGER.trace("Exit AllSatisfactionsToCsv class");
        return actionResult;
    }


    private void writeToCsv(QueryResult result, OutputStream outputStream, Resource resource, List<String> columnsNames) throws RepositoryException, IOException {
        DateFormat dateFormat = new SimpleDateFormat("HH:mm:ss dd/MM/yyyy");
        int maxLevels = ExportToCsvService.maxLevelsPath(result);

        ExportToCsvService.writeHeader(outputStream, maxLevels,
                "Tree Levels", "Tree Levels",
                columnsNames, resource.getLocale(), "exportContentToCsv");

        // Write CSV lines
        NodeIterator nodes = result.getNodes();
        int nodeCount = 0;

        LOGGER.debug("Starting CSV export...");
        try {
            while (nodes.hasNext()) {
                Node node = nodes.nextNode();
                try {
                    String csvLine = formatNodeAsCsvLine(node, maxLevels, dateFormat);
                    outputStream.write(csvLine.getBytes());
                    nodeCount++;
                } catch (IOException e) {
                    LOGGER.error("Error writing node to CSV: " + node.getPath(), e);
                }
            }
            outputStream.flush();
            LOGGER.info("Export completed successfully. Total nodes processed: {}", nodeCount);
        } catch (IOException e) {
            LOGGER.error("Error during CSV export", e);
            throw e;
        }
    }


    protected String constructStringQuery(String contentType, Resource resource) {
        JCRNodeWrapper currentFolder = resource.getNode();
        String nodeType = (contentType != null && !contentType.isEmpty()) ? contentType : "nt:base";

        return "SELECT * FROM [" +
                nodeType +
                "] as node WHERE ISDESCENDANTNODE(node,'" +
                currentFolder.getPath() +
                "') ORDER BY node.[j:fullpath]";
    }

    private String formatNodeAsCsvLine(Node node, int maxLevels, DateFormat dateFormat) throws RepositoryException {
        StringBuilder line = new StringBuilder();

        try {
            // Add path levels
            String[] levels = node.getPath().split("/");
            for (int i = 1; i < maxLevels; i++) {
                line.append(i < levels.length ? escapeCsvValue(levels[i]) : "").append(CSV_SEPARATOR);
            }

            // Add properties dynamically
            PropertyIterator properties = node.getProperties();
            while (properties.hasNext()) {
                Property property = properties.nextProperty();
                try {
                    if (property.isMultiple()) {
                        Value[] values = property.getValues();
                        line.append(Arrays.stream(values)
                                .map(v -> {
                                    try {
                                        return escapeCsvValue(v.getString());
                                    } catch (RepositoryException e) {
                                        try {
                                            LOGGER.warn("Error processing multi-value property: " + property.getName(), e);
                                        } catch (RepositoryException ex) {
                                            throw new RuntimeException(ex);
                                        }
                                        return "";
                                    }
                                })
                                .collect(Collectors.joining(", ")));
                    } else {
                        line.append(escapeCsvValue(property.getValue().getString()));
                    }
                } catch (RepositoryException e) {
                    LOGGER.warn("Error processing property: " + property.getName(), e);
                }
                line.append(CSV_SEPARATOR);
            }

            // Add creation date if available
            if (node.hasProperty("jcr:created")) {
                line.append(dateFormat.format(node.getProperty("jcr:created").getValue().getDate().getTime()));
            }
        } catch (RepositoryException e) {
            LOGGER.error("Error formatting CSV line for node: " + node.getPath(), e);
        }

        return line.append("\n").toString();
    }

    private String escapeCsvValue(String value) {
        if (value == null) {
            return "";
        }
        return "\"" + value.replace("\"", "\"\"") + "\""; // Escape double quotes
    }
}
