# QuickSight RLS Management Schema

:warning: Work in progress

This schema shows the resources created by the **RLS Manager**. Some resources are use by all the solution and created when initiating the Amplify App, some other are Region-specific and created only when a new Region is managed through the solution.

The access to the RLS Manager is managed using Amazon Cognito.

The [Data Models](#data-models) are created using Amazon Dynamo DB.

There's a set of AWS Lambda [functions](#lambda-functions) that are used to interact with all the resources, QuickSight included.

The RLS data are stored in DynamoDB. When the RLS is pushed to QuickSight, a CSV file is created in a S3 bucket, a table is created/modified in a Glue Database, and then a QuickSight DataSet is created for you, passing through Athena and saving the data in QuickSight SPICE.

![Architecture](/Guide/images/RLS-Tool-Architecture.png)

## Data Models
These Dynamo DB table are used to store the Permissions data and manage all the RLS creation.
The DataModel definition is in `amplify/data/resource.ts`.

* [AccountDetails](#accountdetails)
* [ManagedRegions](#managedregion)
* [Namespace](#namespace)
* [DataSet](#dataset)
* [UserGroup](#usergroup)
* [Permission](#permission)

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

* `rlsEnabled`: indicates if the selected DataSet has any RLS enabled
* `rlsToolManaged`: if `rlsEnabled` is true, this field states if RLS is managed through **RLS Manager** or not.
* `rlsDataSetId`: if `rlsEnabled` is true, this is the DataSet **ARN** of the DataSet used as RLS for the selected DataSet. :warning: The name of the field should be more properly `rlsDataSetArn`. Will change it in future releases.
* `toolCreated`: this states if the DataSet has bee created by the RLS Manager. This info cannot be fetched from the APIs. So, for this field in particular, if the data is modified, there's no way to fetch back the info. It will only be possibile to fix it manually. :warning: I've Added in a new release a `tag` to the RLS DataSet `RLS-Manager: true`, but the fetch of this info is still to be implemented.
* `glueS3Id`: this value is only used if the DataSet is a RLS DataSet created with RLS Manager and indicates the ID of the GlueTable and the S3 Key used to store the RLS Data for QuickSight

:warning: Could be useful to directly connect ManagedRegion with DataSet (belongsTo - HasMany). 

```ts
DataSet: a
  .model({
    dataSetArn: a.id().required(),                  // Unique ARN identifier for the DataSet
    dataSetId: a.string().required(),               // This is the ID of the DataSet. Can be extracted from the ARN, but it's useful to have it directly available to use
    name: a.string().required(),                    // The Name of the QuickSight DataSet
    rlsEnabled: a.enum(Object.values(rlsStatus)),   // indicates if the selected DataSet has any RLS enabled
    rlsToolManaged: a.boolean().required(),         // states if RLS is managed through **RLS Manager** or not.
    rlsDataSetId: a.string(),                       // This is the ARN (not the ID) of the RLS DataSet applied to the selected Dataset
    apiManageable: a.boolean().required(),          // Indicates if the dataset is manageable by API
    toolCreated: a.boolean().required(),            // Indicates if the dataset is managed by this Tool
    dataSetRegion: a.string().required(),           // The DataSet Region
    glueS3Id: a.string(),                           // if this is a RLS DataSet, then this indicates the ID of the GlueTable and the S3 Key
    spiceCapacityInBytes: a.integer(),              // The DataSet SPICE Capacity used (if import mode is SPICE)
    createdTime: a.string(),                        // The DataSet creation Time
    importMode: a.string(),                         // Import mode: can be DIRECT_QUERY or SPICE
    lastUpdatedTime: a.string(),                    // DataSet last updated time
    fields: a.string().array(),                     // Array of strings containing the list of the DataSet fields
    permissions: a.hasMany('Permission', 'dataSetArn'),   // A DataSet can have many Permissions
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

```ts
Permission: a
  .model({
    dataSetArn: a.string().required(),                    // The ARN of the DataSet we are applying RLS to
    userGroupArn: a.string().required(),                  // The User or Group this Permissions refers to
    dataSet: a.belongsTo('DataSet', 'dataSetArn'),        // Model name and foreign key field
    userGroup: a.belongsTo('UserGroup', 'userGroupArn'),  // Model name and foreign key field
    field: a.string().required(),                         // The DataSet Field we are using in this Permission row
    rlsValues: a.string().required(),                     // Comma-separated list of RLS values
    createdAt: a.datetime(),                              // Utility info
    updatedAt: a.datetime()                               // Utility info
  })  
  .authorization((allow) => [allow.authenticated()]),     // Only authenticated users can access this table
```


## Lambda Functions
The whole solutions uses a set of AWS Lambda functions.
Some of these functions are part of bigger single operations, but I separated them in smaller functions to have an easier code management, but also to correctly manage the timeouts, retry and so on.

This is the list of the Lambda Functions (click on each one to see the details):

* [TODO - checkQSManagementRegionAccess](/Guide/functions/checkQSManagementRegionAccess)
* [TODO - createGlueDatabase](/Guide/functions/createGlueDatabase)
* [TODO - createQSDataSource](/Guide/functions/createQSDataSource)
* [TODO - createS3Bucket](/Guide/functions/createS3Bucket)
* [TODO - deleteDataSetFromQS](/Guide/functions/deleteDataSetFromQS)
* [TODO - deleteDataSetGlueTable](/Guide/functions/deleteDataSetGlueTable)
* [TODO - deleteDataSetS3Objects](/Guide/functions/deleteDataSetS3Objects)
* [TODO - fetchDataSetFieldsFromQS](/Guide/functions/fetchDataSetFieldsFromQS)
* [TODO - fetchDataSetsFromQS](/Guide/functions/fetchDataSetsFromQS)
* [TODO - fetchGroupsFromQS](/Guide/functions/fetchGroupsFromQS)
* [TODO - fetchNamespacesFromQS](/Guide/functions/fetchNamespacesFromQS)
* [TODO - fetchUsersFromQS](/Guide/functions/fetchUsersFromQS)
* [TODO - getQSSpiceCapacity](/Guide/functions/getQSSpiceCapacity)
* [publishRLS00ResourcesValidation](/Guide/functions/publishRLS00ResourcesValidation)
* [publishRLS01S3](/Guide/functions/publishRLS01S3)
* [publishRLS02Glue](/Guide/functions/publishRLS02Glue)
* [publishRLS03QsRLSDataSet](/Guide/functions/publishRLS03QsRLSDataSet)
* [publishRLS04QsUpdateMainDataSetRLS](/Guide/functions/publishRLS04QsUpdateMainDataSetRLS)
* [publishRLS99QsCheckIngestion](/Guide/functions/publishRLS99QsCheckIngestion)
* [TODO - removeRLSDataSet](/Guide/functions/removeRLSDataSet)
* [setAccount](/Guide/functions/setAccount)
