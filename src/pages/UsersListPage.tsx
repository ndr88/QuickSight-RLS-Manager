import { useState, useEffect } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Badge, Box, BreadcrumbGroup, ButtonDropdown, Container, ContentLayout, Header, Link, PropertyFilter, SpaceBetween, Table, TextContent } from "@cloudscape-design/components";
import { useCollection } from '@cloudscape-design/collection-hooks';
import { useHelpPanel } from "../contexts/HelpPanelContext";

const client = generateClient<Schema>();

function UsersListPage() {
  const { setHelpPanelContent, setIsHelpPanelOpen } = useHelpPanel();

  const [users, setUsers] = useState<any[]>([]);

  const [maxUpdatedAt, setMaxUpdatedAt] = useState<string>("")

  const [isLoading, setIsLoading] = useState<boolean>(true)
  
  const { items, collectionProps, propertyFilterProps } = useCollection(
    users,
    {
      filtering: {
        empty: (
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No users</b>
            </SpaceBetween>
          </Box>
        ),
        noMatch: (
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No matches</b>
            </SpaceBetween>
          </Box>
        ),
      },
      propertyFiltering: {
        filteringProperties: [
          {
            key: 'namespaceName',
            propertyLabel: 'Namespace',
            groupValuesLabel: 'Namespace values',
            operators: ['=', '!=', ':', '!:']
          },
          {
            key: 'name',
            propertyLabel: 'User Name',
            groupValuesLabel: 'User Name values',
            operators: ['=', '!=', ':', '!:']
          },
          {
            key: 'email',
            propertyLabel: 'Email',
            groupValuesLabel: 'Email values',
            operators: ['=', '!=', ':', '!:']
          },
          {
            key: 'role',
            propertyLabel: 'Role',
            groupValuesLabel: 'Role values',
            operators: ['=', '!=', ':', '!:']
          },
          {
            key: 'identityType',
            propertyLabel: 'Identity Type',
            groupValuesLabel: 'Identity Type values',
            operators: ['=', '!=', ':', '!:']
          }
        ],
        empty: (
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No users</b>
            </SpaceBetween>
          </Box>
        ),
        noMatch: (
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No matches</b>
            </SpaceBetween>
          </Box>
        ),
      },
      sorting: {
        defaultState: {
          sortingColumn: {
            sortingField: 'name'
          },
          isDescending: false
        }
      }
    }
  );

  useEffect(() => {
    setIsLoading(true)
    const loadUsers = async () => {
      try {
        const userData = await fetchUsersUsers('User');
        setUsers(userData || []);
        fetchAccountDetails();
      } catch (err) {
        throw new Error(`Error fetching users: ${err}`);
      } finally{
        setIsLoading(false)
      }
    };
  
    loadUsers();

    setHelpPanelContent(
      <SpaceBetween size="l">
        <TextContent>
          <p>These are the <i>QuickSight Users</i> found in your instance.</p>
        </TextContent>
        
        <Header variant="h3">User Roles:</Header>
        <TextContent>
          <ul>
            <li><Badge color="severity-critical">ADMIN_PRO</Badge> - Full administrative access with advanced features</li>
            <li><Badge color="severity-high">ADMIN</Badge> - Full administrative access</li>
            <li><Badge color="severity-medium">AUTHOR_PRO</Badge> - Can create and publish content with advanced features</li>
            <li><Badge color="severity-low">AUTHOR</Badge> - Can create and publish content</li>
            <li><Badge color="blue">READER_PRO</Badge> - Can view content with advanced features</li>
            <li><Badge color="grey">READER</Badge> - Can view content only</li>
          </ul>
        </TextContent>
        
        <Header variant="h3">Identity Types:</Header>
        <TextContent>
          <ul>
            <li><Badge color="severity-critical">IAM_IDENTITY_CENTER</Badge> - Users from AWS IAM Identity Center (formerly AWS SSO)</li>
            <li><Badge color="severity-high">IAM</Badge> - Users from AWS IAM</li>
            <li><Badge color="blue">QUICKSIGHT</Badge> - QuickSight-only users</li>
          </ul>
        </TextContent>
      </SpaceBetween>
    );
    setIsHelpPanelOpen(false); 

    // Cleanup when component unmounts
    return () => {
      setHelpPanelContent(null);
      setIsHelpPanelOpen(false);
    };
  }, [setHelpPanelContent]);

  const fetchUsersUsers = async (filterValue?: string) => {
    try {
      const response = await client.models.UserGroup.list({
        filter: filterValue ? {
          userGroup: {
            eq: filterValue
          }
        } : undefined
      });
      return response.data;
    } catch (err) {
      throw new Error(`Error fetching users: ${err}`);
    }
  };

  // Helper function to get role badge color
  const getRoleBadgeColor = (role: string): "severity-critical" | "severity-high" | "severity-medium" | "severity-low" | "blue" | "grey" => {
    switch (role) {
      case 'ADMIN_PRO':
        return 'severity-critical';
      case 'ADMIN':
        return 'severity-high';
      case 'AUTHOR_PRO':
        return 'severity-medium';
      case 'AUTHOR':
        return 'severity-low';
      case 'READER_PRO':
        return 'blue';
      case 'READER':
        return 'grey';
      default:
        return 'grey';
    }
  };

  // Helper function to get identity type badge color
  const getIdentityTypeBadgeColor = (identityType: string): "severity-critical" | "severity-high" | "blue" => {
    switch (identityType) {
      case 'IAM':
        return 'severity-high';
      case 'QUICKSIGHT':
        return 'blue';
      case 'IAM_IDENTITY_CENTER':
        return 'severity-critical';
      default:
        return 'blue';
    }
  };

  // Calculate user counts per role
  const getRoleCounts = () => {
    const counts: Record<string, number> = {};
    users.forEach(user => {
      const role = user.role || 'Unknown';
      counts[role] = (counts[role] || 0) + 1;
    });
    return counts;
  };

  const fetchAccountDetails = async () => {

    try {
      const response = await client.models.AccountDetails.list({
        authMode: 'userPool'
      });
      if (response.data.length > 0 && response.data[0]) { 
        setMaxUpdatedAt(response.data[0].updatedAt || "")
      }else{
        console.warn("Fetching Account Details: Account Details are not available. Please enter them.")
      }
    } catch (err) {
      console.error('Fetching Account Details: Error fetching Account Details:', err);
    } 
  };

  return (
    <>
      <BreadcrumbGroup
        items={[
          { text: "QS Managed RLS Tool", href: "/" },
          { text: "Explore Data", href: "/" },
          { text: "Users", href: "/users-list" },
        ]}
      />
      <ContentLayout
        defaultPadding
        header={
          <Header
            variant="h1"
            description="These are the Users of your QuickSight Account synchronized with the tool."
          >
          Explore Data: Users
          </Header>
        }
      >
        <SpaceBetween size="l">
          <Container
          >
            <Table
              {...collectionProps}
              loadingText="Loading QuickSight Users"
              loading={isLoading}
              stripedRows
              wrapLines
              variant="embedded"
              filter={
                <PropertyFilter
                  {...propertyFilterProps}
                  i18nStrings={{
                    filteringAriaLabel: 'Filter users',
                    filteringPlaceholder: 'Filter users',
                    clearFiltersText: 'Clear filters',
                    removeTokenButtonAriaLabel: (token) => `Remove filter ${token.propertyKey}`,
                  }}
                />
              }
              header={
                <SpaceBetween size="l">
                  <Header
                    variant="h2"
                    description={`Last Update: ${maxUpdatedAt || ''}`}
                    actions={
                      <SpaceBetween
                        direction="horizontal"
                        size="xs"
                      >
                        <ButtonDropdown
                          items={[
                            {
                              text: "Refresh Users",
                              id: "rm",
                              disabled: true
                            },
                          ]}
                        >
                          Actions
                        </ButtonDropdown>
                      </SpaceBetween>
                    }
                  >
                    Users List
                  </Header>
                  <Box padding={{ bottom: "s" }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {Object.entries(getRoleCounts()).map(([role, count], index) => (
                        <div 
                          key={role}
                          style={{ 
                            textAlign: 'center',
                            padding: '12px 16px',
                            borderRight: index < Object.entries(getRoleCounts()).length ? '1px solid #e9ebed' : 'none',
                            flex: 1
                          }}
                        >
                          <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>{role}</Box>
                          <div style={{ display: 'inline-block', minWidth: '50px' }}>
                            <Badge color={getRoleBadgeColor(role)}>{count}</Badge>
                          </div>
                        </div>
                      ))}
                      <div 
                        style={{ 
                          textAlign: 'center',
                          padding: '12px 16px',
                          flex: 1
                        }}
                      >
                        <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Total Users</Box>
                        <Box fontSize="heading-m" fontWeight="bold">{users.length}</Box>
                      </div>
                    </div>
                  </Box>
                </SpaceBetween>
              }
              empty={
                <Box
                  margin={{ vertical: "xs" }}
                  textAlign="center"
                  color="inherit"
                >
                  <TextContent>
                    <p><strong>No Users Found.</strong></p>
                    <p>Please check that you have Users in QuickSight.</p>
                    <p>If you think you should see Users here, go to <Link href="/">Homepage</Link> to launch <strong>resources update</strong>.</p>
                  </TextContent>
                </Box>
              }
              columnDefinitions={[
                {
                  id: "Namespace",
                  header: "Namespace",
                  cell: (item: any) => item.namespaceName,
                  sortingField: "namespaceName",
                },
                {
                  id: "UserName",
                  header: "User Name",
                  cell: (item: any) => item.name,
                  sortingField: "name",
                },
                {
                  id: "Email",
                  header: "Email",
                  cell: (item: any) => item.email,
                  sortingField: "email",
                },
                {
                  id: "Role",
                  header: "Role",
                  cell: (item: any) => (
                    <Badge color={getRoleBadgeColor(item.role)}>
                      {item.role}
                    </Badge>
                  ),
                  sortingField: "role",
                },
                {
                  id: "Description",
                  header: "Description",
                  cell: (item: any) => item.description,
                },
                {
                  id: "IdentityType",
                  header: "Identity Type",
                  cell: (item: any) => (
                    <Badge color={getIdentityTypeBadgeColor(item.identityType)}>
                      {item.identityType}
                    </Badge>
                  ),
                  sortingField: "identityType",
                },
                {
                  id: "UserArn",
                  header: "User Arn",
                  cell: (item: any) => item.userGroupArn,
                },
              ]}
              items={items}
              /*
              preferences={
                <CollectionPreferences 
                  title="Preferences"
                  confirmLabel="Confirm"
                  cancelLabel="Cancel"
                  preferences={{
                    pageSize: 10,
                  }}
                  pageSizePreference={{
                    title: "Page size",
                    options: [
                      { value: 10, label: "10 resources" },
                      { value: 20, label: "20 resources" },
                      { value: 50, label: "50 resources" },
                      { value: 100, label: "100 resources" }
                    ]
                  }}
                />
              }*/
            />
          </Container>
        </SpaceBetween>
      </ContentLayout>
    </>
  );
}

export default UsersListPage;