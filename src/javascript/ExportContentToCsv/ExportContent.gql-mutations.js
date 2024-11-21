import {gql} from '@apollo/client';

export const JiraUserConfigMutation = gql`
    mutation postJiraUserConfig(
        $path: String!,
        $jiraUserId: String!,
        $jiraUserApiToken: String!,
        $publish: Boolean!
    ) {
        jcr {
            mutateNode(pathOrId: $path) {
                addMixins(mixins: ["jiramix:jiraUser"])

                jiraUserId: mutateProperty(name: "jira:jiraUserId") {
                    setValue(value: $jiraUserId)
                }

                jiraUserApiToken: mutateProperty(name: "jira:jiraUserApiToken") {
                    setValue(value: $jiraUserApiToken)
                }

                publish @include(if: $publish)
            }
        }
    }
`;
