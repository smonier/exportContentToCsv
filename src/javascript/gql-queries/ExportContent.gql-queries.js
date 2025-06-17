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
                descendants(typesFilter: {types: [$type]}) {
                    nodes {
                        uuid: uuid
                        properties(names: $properties, language: $language) {
                            name
                            value
                            values
                            definition {
                                multiple
                            }
                        }
                        tagList: properties(names: ["j:tagList"]) {
                            values
                        }
                        categoryList: property(name: "j:defaultCategory") {
                            categories: refNodes {
                                name: displayName(language: $language)
                            }
                        }
                        interests: property(name: "wem:interests") {
                            values
                        }
                    }
                }
            }
        }
    }
`;
