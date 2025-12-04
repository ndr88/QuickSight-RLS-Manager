# QuickSight RLS Management Schema

:warning: Work in progress

This schema shows the resources created by the **RLS Manager**. Some resources are use by all the solution and created when initiating the Amplify App, some other are Region-specific and created only when a new Region is managed through the solution.

The access to the RLS Manager is managed using Amazon Cognito.

The [Data Models](#data-models) are created using Amazon Dynamo DB.

There's a set of AWS Lambda [functions](#lambda-functions) that are used to interact with all the resources, QuickSight included.

The RLS data are stored in DynamoDB. When the RLS is pushed to QuickSight, a CSV file is created in a S3 bucket, a table is created/modified in a Glue Database, and then a QuickSight DataSet is created for you, passing through Athena and saving the data in QuickSight SPICE.

![Architecture](/Guide/images/RLS-Tool-Architecture.png)

## Data Models
These DynamoDB tables are used to store the Permissions data and manage all the RLS creation.
The DataModel definition is in `amplify/data/resource.ts`.

* [AccountDetails](#accountdetails)
* [ManagedRegion](#managedregion)
* [Namespace](#namespace)
* [DataSet](#dataset)
* [UserGroup](#usergroup)
* [Permission](#permission)
* [RLSDataSetVisibility](#rlsdatasetvisibility)
* [PublishHistory](#publishhistory)

![Dynamo DB schemas](/Guide/images/DynamoDBSchema.png)

### AccountDetails
This table is used to save info of the Account at global level. Since there's not quick way (at the moment) to get some info like number of elements in a table from Amplify-managed GraphQL APIs, we store some info here to do quicker queries and search in less data.

Potentially, this schema is ready to store data of multiple QuickSight accounts (for feature evolution of the solution).
```ts
AccountDetails: a
  .model({
    accountId: a.id().required(),               // The AWS Account ID where the solution is installed
    qsManagementRegion: a.string().required(),  // The QuickSight Management Region: the region where you manage QS authentication and resources
    namespacesCount: a.integer().required(),    // The number of QS Namespaces found in the QS Account
    groupsCount: a.integer().required(),        // The number of users Group QS 
    usersCount: a.integer().required(),         // The number of Users in QS
    createdAt: a.datetime(),                    // Utility info
    updatedAt: a.datetime()                     // Utility info
  })
  .identifier(['accountId'])                    // The identifier for this table is the accountId
  .authorization((allow) => [                   // Only authenticated users can access this table
    allow.authenticated(),
  ])
```

### ManagedRegion
This table stores info of the AWS Regions we are managing with RLS Manager. 
Note that this is not the *QuickSight Management Region*. The QS Management Region is the one where all the QS Users, Groups, resources permissions etc are defined. 
Here we are storing info of all the Regions where QuickSight is enabled and where we want to manage RLS using the **RLS Manager**.

:warning: to enable multi account management, this table has to be modified adding `accountId` info.

`s3BucketName`, `glueDatabaseName` and `qsDataSource` refer to the resources created by the RLS Manager once we activate the management of a specific Region.

```ts
ManagedRegion: a
  .model({
    regionName: a.id().required(),                        // This is the AWS region name, e.g. eu-central-1
    availableCapacityInGB: a.float().required(),          // The total SPICE capacity available in the Region
    usedCapacityInGB: a.float().required(),               // The total SPICE capacity used in the Region
    s3BucketName: a.string().required(),                  // The ID of the S3 bucket created in this Region
    glueDatabaseName: a.string().required(),              // The ID of the Glue DB created in this Region
    qsDataSource: a.string().required(),                  // The ID of the QuickSight DataSource created in this Region
    datasetsCount: a.integer().required(),                // The total number of DataSets found in this region
    notManageableDatasetsCount: a.integer().required(),   // The number of DataSets that cannot be managed using APIs
    toolCreatedCount: a.integer().required(),             // The number of DataSets created using the RLS Manager
    createdAt: a.datetime(),                              // Utility info
    updatedAt: a.datetime()                               // Utility info
  })
  .identifier(['regionName'])                             // The identifier for this table is the regionName.
  .authorization((allow) => [                             // Only authenticated users can access this table
    allow.authenticated(),
  ])
```

### Namespace
In the `Namespace` table we save info about the existing QuickSight Namespaces. 
`capacityRegion` is at the moment a info fetched though APIs and saved here, but not used.
In a Namespace you can have multiple Groups and Users.
The table can be ready for multi-account management without changes, since the `namespaceArn` is unique.

```ts
Namespace: a
  .model({
    namespaceArn: a.id().required(),                      // Unique identifier for the namespace
    namespaceName: a.string().required(),                 // The friendly name of the Namespace (e.g. "default")
    capacityRegion: a.string().required(),                // not used, but indicates the Region where the Namespace is created
    userGroups: a.hasMany('UserGroup', 'namespaceName'),  // Users and Groups associated with the namespace
    createdAt: a.datetime(),                              // Utility info
    updatedAt: a.datetime()                               // Utility info
  })
  .identifier(['namespaceArn'])                           // The identifier for this table is the namespaceArn
  .authorization((allow) => [                             // Only authenticated users can access this table
    allow.authenticated(),
  ])
```

### DataSet
`DataSet` table contains info about the QuickSight DataSets. There are multiple info fetched through APIs, and others added for the **RLS Manager** correct execution.
:warning: Changing any of this data manually can prevent the **RLS Manager** to work as expected.

Since the ID for the table is the `dataSetArn`, also in this case the table can be considered ready for multi-account management, although having the `accountId` as field can be useful.

**Key Fields**:
* `rlsEnabled`: indicates if the selected DataSet has any RLS enabled
* `rlsToolManaged`: if `rlsEnabled` is true, this field states if RLS is managed through **RLS Manager** or not
* `rlsDataSetId`: if `rlsEnabled` is true, this is the DataSet **ARN** of the DataSet used as RLS for the selected DataSet
* `isRls`: indicates if this DataSet itself is an RLS DataSet
* `newDataPrep`: indicates if the DataSet uses the new QuickSight data prep experience (has DataPrepConfiguration)
* `toolCreated`: states if the DataSet has been created by the RLS Manager (tagged with `RLS-Manager: true`)
* `glueS3Id`: if this is an RLS DataSet created with RLS Manager, indicates the ID of the GlueTable and the S3 Key
* `fieldTypes`: JSON string containing field name to type mapping
* `currentVersion`: current version number (increments on each publish)
* `lastPublishedVersion`: last successfully published version
* `lastPublishedAt`: timestamp of last successful publish

:warning: Could be useful to directly connect ManagedRegion with DataSet (belongsTo - HasMany). 

```ts
DataSet: a
  .model({
    dataSetArn: a.id().required(),                  // Unique ARN identifier for the DataSet
    dataSetId: a.string().required(),               // This is the ID of the DataSet
    name: a.string().required(),                    // The Name of the QuickSight DataSet
    rlsEnabled: a.enum(Object.values(rlsStatus)),   // indicates if the selected DataSet has any RLS enabled
    rlsToolManaged: a.boolean().required(),         // states if RLS is managed through **RLS Manager** or not
    rlsDataSetId: a.string(),                       // This is the ARN of the RLS DataSet applied to the selected Dataset
    isRls: a.boolean().required(),                  // Indicates if this DataSet is an RLS DataSet
    newDataPrep: a.boolean().required(),            // Indicates if dataset uses new data prep mode
    apiManageable: a.boolean().required(),          // Indicates if the dataset is manageable by API
    toolCreated: a.boolean().required(),            // Indicates if the dataset is managed by this Tool
    dataSetRegion: a.string().required(),           // The DataSet Region
    glueS3Id: a.string(),                           // if this is a RLS DataSet, ID of GlueTable and S3 Key
    spiceCapacityInBytes: a.integer(),              // The DataSet SPICE Capacity used (if import mode is SPICE)
    createdTime: a.string(),                        // The DataSet creation Time
    importMode: a.string(),                         // Import mode: can be DIRECT_QUERY or SPICE
    lastUpdatedTime: a.string(),                    // DataSet last updated time
    fieldTypes: a.string(),                         // JSON string: field name to type mapping
    currentVersion: a.integer(),                    // Current version number
    lastPublishedVersion: a.integer(),              // Last successfully published version
    lastPublishedAt: a.datetime(),                  // When last published to QuickSight
    permissions: a.hasMany('Permission', 'dataSetArn'),         // A DataSet can have many Permissions
    rlsVisibility: a.hasMany('RLSDataSetVisibility', 'dataSetArn'),  // RLS DataSet visibility permissions
    publishHistory: a.hasMany('PublishHistory', 'dataSetArn'), // Publish history records
    createdAt: a.datetime(),                        // Utility info
    updatedAt: a.datetime()                         // Utility info
  })
  .identifier(['dataSetArn'])                       // The DataSetArn is used as identifier for this table
  .authorization((allow) => [allow.authenticated()]), // Only authenticated users can access this table
```

### UserGroup
The `UserGroup` table contains the list of both Users and Groups in QuickSight. 
The `userGroup` field indicates if the row refers to a User or to a Group.

:warning: It should be better to correlate DataSet to Namespace using namespaceArn and not namespaceName

```ts
UserGroup: a
  .model({
    userGroup: a.enum(Object.values(UserGroupType)),      // Indicates User or Group
    name: a.string().required(),                          // Name of the user or group
    userGroupArn: a.id().required(),                      // Amazon Resource Name
    namespaceName: a.string().required(),                 // Namespace name
    namespace: a.belongsTo('Namespace', 'namespaceName'), // Namespace
    email: a.string().required(),                         // Email address (only User)
    role: a.string().required(),                          // Role (optional, for Users)
    identityType: a.string(),                             // Identity type (optional, for Users)
    active: a.boolean(),                                  // Active status (optional, for Users)
    principalId: a.string(),                              // Principal ID
    description: a.string(),                              // Description, if any
    permission: a.hasMany('Permission', 'userGroupArn'),  // A User-Group can have many Permissions
    createdAt: a.datetime(),                              // Utility info
    updatedAt: a.datetime()                               // Utility info
  })
  .identifier(['userGroupArn'])                           // The User or Group ARN is used as identifier for this table
  .authorization((allow) => [allow.authenticated()]),     // Only authenticated users can access this table
```

### Permission
This is the core table for all the solution. Here the Permissions are stored as single rows, and then, when pushing the RLS to QuickSight or creating the CSV file to be exported, the Permissions are then rearranged in the output QuickSight needs as RLS Format.

In this specific case we do not have an ARN, so the ID for this table is completely managed by the solution: there is a field called `id` not visible in the schema definition.

**Key Fields**:
* `status`: tracks the permission state - PENDING (not yet published), PUBLISHED (applied to QuickSight), FAILED (publish failed), MANUAL (non-API manageable dataset)
* `lastPublishedAt`: timestamp of when the permission was last successfully published to QuickSight

```ts
Permission: a
  .model({
    dataSetArn: a.string().required(),                    // The ARN of the DataSet we are applying RLS to
    userGroupArn: a.string().required(),                  // The User or Group this Permissions refers to
    dataSet: a.belongsTo('DataSet', 'dataSetArn'),        // Model name and foreign key field
    userGroup: a.belongsTo('UserGroup', 'userGroupArn'),  // Model name and foreign key field
    field: a.string().required(),                         // The DataSet Field we are using in this Permission row
    rlsValues: a.string().required(),                     // Comma-separated list of RLS values
    status: a.enum(['PENDING', 'PUBLISHED', 'FAILED', 'MANUAL']), // Status of the permission
    lastPublishedAt: a.datetime(),                        // When last successfully published to QuickSight
    createdAt: a.datetime(),                              // Utility info
    updatedAt: a.datetime()                               // Utility info
  })  
  .authorization((allow) => [allow.authenticated()]),     // Only authenticated users can access this table
```

### RLSDataSetVisibility
This table manages who can see and access RLS DataSets in QuickSight. It controls the permissions on the RLS DataSets themselves (not the main DataSets).

**Key Fields**:
* `rlsDataSetArn`: the ARN of the RLS DataSet
* `dataSetArn`: the main DataSet ARN (for reference)
* `userGroupArn`: the user or group ARN
* `permissionLevel`: OWNER (full access) or VIEWER (read-only)

```ts
RLSDataSetVisibility: a
  .model({
    rlsDataSetArn: a.string().required(),                 // The RLS dataset ARN
    dataSetArn: a.string().required(),                    // The main dataset ARN (for reference)
    userGroupArn: a.string().required(),                  // User or group ARN
    permissionLevel: a.enum(['OWNER', 'VIEWER']),         // OWNER or VIEWER
    dataSet: a.belongsTo('DataSet', 'dataSetArn'),
    userGroup: a.belongsTo('UserGroup', 'userGroupArn'),
    createdAt: a.datetime(),
    updatedAt: a.datetime()
  })
  .authorization((allow) => [allow.authenticated()]),
```

### PublishHistory
This table tracks the history of RLS publishes for audit and rollback purposes. Each publish creates a new version record.

**Key Fields**:
* `version`: version number (increments with each publish)
* `publishedAt`: timestamp of the publish
* `s3VersionId`: S3 version ID of the CSV file (enables rollback)
* `status`: SUCCESS or FAILED

```ts
PublishHistory: a
  .model({
    dataSetArn: a.string().required(),                    // The dataset this publish belongs to
    version: a.integer().required(),                      // Version number
    publishedAt: a.datetime().required(),                 // When published
    publishedBy: a.string(),                              // User who published (optional)
    s3VersionId: a.string(),                              // S3 version ID of the CSV file
    s3Key: a.string(),                                    // S3 key of the CSV file
    permissionCount: a.integer().required(),              // Number of permissions in this version
    status: a.enum(['SUCCESS', 'FAILED']),                // Publish status
    errorMessage: a.string(),                             // Error message if failed
    dataSet: a.belongsTo('DataSet', 'dataSetArn'),
    createdAt: a.datetime(),
    updatedAt: a.datetime()
  })
  .authorization((allow) => [allow.authenticated()]),
```


## Lambda Functions
The whole solution uses a set of AWS Lambda functions.
Some of these functions are part of bigger single operations, but I separated them into smaller functions to have easier code management, and to correctly manage timeouts, retries, and so on.

This is the complete list of Lambda Functions organized by category. Click on each one to see the detailed documentation:

### RLS Publishing Workflow Functions
* [publishRLS00ResourcesValidation](../amplify/functions/publishRLS00ResourcesValidation/README.md) - Step 0: Validates resources before publishing
* [publishRLS01S3](../amplify/functions/publishRLS01S3/README.md) - Step 1: Uploads CSV to S3
* [publishRLS02Glue](../amplify/functions/publishRLS02Glue/README.md) - Step 2: Creates/updates Glue table
* [publishRLS03QsRLSDataSet](../amplify/functions/publishRLS03QsRLSDataSet/README.md) - Step 3: Creates/updates RLS DataSet
* [publishRLS04QsUpdateMainDataSetRLS](../amplify/functions/publishRLS04QsUpdateMainDataSetRLS/README.md) - Step 4: Applies RLS to main DataSet
* [publishRLS99QsCheckIngestion](../amplify/functions/publishRLS99QsCheckIngestion/README.md) - Step 99: Checks SPICE ingestion status

### Resource Creation Functions
* [createS3Bucket](../amplify/functions/createS3Bucket/README.md) - Creates S3 bucket for RLS data
* [createGlueDatabase](../amplify/functions/createGlueDatabase/README.md) - Creates Glue Database
* [createQSDataSource](../amplify/functions/createQSDataSource/README.md) - Creates QuickSight DataSource

### Data Fetching Functions
* [fetchDataSetsFromQS](../amplify/functions/fetchDataSetsFromQS/README.md) - Lists QuickSight DataSets
* [fetchDataSetFieldsFromQS](../amplify/functions/fetchDataSetFieldsFromQS/README.md) - Gets DataSet fields and SPICE capacity
* [fetchGroupsFromQS](../amplify/functions/fetchGroupsFromQS/README.md) - Lists QuickSight groups
* [fetchUsersFromQS](../amplify/functions/fetchUsersFromQS/README.md) - Lists QuickSight users
* [fetchNamespacesFromQS](../amplify/functions/fetchNamespacesFromQS/README.md) - Lists QuickSight namespaces
* [fetchRLSDataSetPermissions](../amplify/functions/fetchRLSDataSetPermissions/README.md) - Gets RLS DataSet permissions

### Data Deletion Functions
* [deleteDataSetFromQS](../amplify/functions/deleteDataSetFromQS/README.md) - Deletes QuickSight DataSet
* [deleteDataSetGlueTable](../amplify/functions/deleteDataSetGlueTable/README.md) - Deletes Glue table
* [deleteDataSetS3Objects](../amplify/functions/deleteDataSetS3Objects/README.md) - Deletes S3 objects

### Utility Functions
* [checkQSManagementRegionAccess](../amplify/functions/checkQSManagementRegionAccess/README.md) - Validates QuickSight access
* [getQSSpiceCapacity](../amplify/functions/getQSSpiceCapacity/README.md) - Gets SPICE capacity metrics
* [removeRLSDataSet](../amplify/functions/removeRLSDataSet/README.md) - Removes RLS from DataSet
* [setAccount](../amplify/functions/setAccount/README.md) - Initializes account configuration
* [updateRLSDataSetPermissions](../amplify/functions/updateRLSDataSetPermissions/README.md) - Updates RLS DataSet permissions

### Version Management Functions
* [listPublishHistory](../amplify/functions/listPublishHistory/README.md) - Lists version history
* [getVersionContent](../amplify/functions/getVersionContent/README.md) - Gets content of a specific version
* [rollbackToVersion](../amplify/functions/rollbackToVersion/README.md) - Rolls back to a previous version

### Shared Utilities
* [_shared](../amplify/functions/_shared/README.md) - Common utilities, AWS clients, error handling, and logging
