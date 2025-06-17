import org.jahia.se.modules.exporttocsv.actions.RequestExportToCsv;
import org.jahia.services.render.Resource;
import org.jahia.services.render.RenderContext;
import org.jahia.services.content.JCRNodeWrapper;
import org.jahia.services.content.JCRSessionWrapper;
import org.jahia.services.render.URLResolver;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import javax.jcr.query.QueryResult;
import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class RequestExportToCsvTest {

    private static class TestableRequestExportToCsv extends RequestExportToCsv {
        String capturedContentType;
        @Override
        protected String constructStringQuery(String contentType, Resource resource) {
            this.capturedContentType = contentType;
            throw new RuntimeException("stop");
        }
        @Override
        protected void writeToCsv(QueryResult result, OutputStream outputStream, Resource resource, List<String> columnsNames) {
            // no-op for test
        }
    }

    @Test
    public void testContentTypeParameterIsRead() {
        TestableRequestExportToCsv action = new TestableRequestExportToCsv();

        Map<String, List<String>> params = new HashMap<>();
        params.put("contentTypeToExport", Collections.singletonList("jnt:test"));

        HttpServletRequest request = Mockito.mock(HttpServletRequest.class);
        RenderContext renderContext = Mockito.mock(RenderContext.class);
        HttpServletResponse response = Mockito.mock(HttpServletResponse.class);
        Resource resource = Mockito.mock(Resource.class);
        JCRNodeWrapper node = Mockito.mock(JCRNodeWrapper.class);
        JCRSessionWrapper session = Mockito.mock(JCRSessionWrapper.class);
        URLResolver urlResolver = Mockito.mock(URLResolver.class);

        try {
            Mockito.when(renderContext.getResponse()).thenReturn(response);
            Mockito.when(response.getOutputStream()).thenReturn(new ServletOutputStream() {
                private final ByteArrayOutputStream bos = new ByteArrayOutputStream();
                @Override
                public boolean isReady() { return true; }
                @Override
                public void setWriteListener(javax.servlet.WriteListener writeListener) { }
                @Override
                public void write(int b) throws IOException { bos.write(b); }
            });
            Mockito.when(resource.getNode()).thenReturn(node);
            Mockito.when(node.getPath()).thenReturn("/test");
        } catch (IOException e) {
            // ignore for test setup
        }

        Assertions.assertThrows(RuntimeException.class, () ->
                action.doExecute(request, renderContext, resource, session, params, urlResolver));

        Assertions.assertEquals("jnt:test", action.capturedContentType);
    }
}
