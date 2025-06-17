import {gql} from '@apollo/client';
import {SIMPLE_CORE_NODE_FIELDS} from './fragments';

export const GetContentTypeQuery = gql`
    query SiteContentTypesQuery($siteKey: String!, $language:String!) {
        jcr {
            nodeTypes(filter: {includeMixins: false, siteKey: $siteKey, includeTypes: ["jmix:droppableContent", "jnt:page", "jnt:file"], excludeTypes: ["jmix:studioOnly", "jmix:hiddenType", "jnt:editableFile"]}) {
                nodes {
                    name
                    displayName(language: $language)
                    icon
                }
            }
        }
    }
`;

export const GetContentPropertiesQuery = gql`
    query GetContentPropertiesQuery($type: String!, $language: String!) {
        jcr {
            nodeTypes(filter: {includeTypes: [$type]}) {
                nodes {
                    properties(fieldFilter: {filters: [{fieldName: "hidden", value: "false"}]}) {
                        name
                        hidden
                        displayName(language: $language)
                    }
                }
            }
        }
    }
`;

export const FetchContentForCSVQuery = gql`
    ${SIMPLE_CORE_NODE_FIELDS}
    query getContentsByContentType($path: String!, $language: String!, $type: String!, $workspace: Workspace!, $properties: [String]) {
        jcr(workspace: $workspace) {
            result: nodeByPath(path: $path) {
                ...SimpleCoreNodeFields
                label: displayName(language: $language)
                descendants(typesFilter: {types: [$type]}) {
                    nodes {
                        ...SimpleCoreNodeFields
                        label: displayName(language: $language)
                        properties(names: $properties, language: $language) {
                            name
                            value
                            values
                            definition {
                                multiple
                            }
                        }
                    }
                }
            }
        }
    }
`;
