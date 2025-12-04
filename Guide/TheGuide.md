# QuickSight Row Level Security Manager: Complete Guide

Welcome to the comprehensive guide for the QuickSight RLS Manager - a solution designed to simplify the management of Row-Level Security in Amazon QuickSight.

## The Problem

Many customers have highlighted the complexity of managing Row-Level Security in QuickSight:

**Anonymous Embedding RLS** (Tag-based):
- ✅ Easy to manage via tags
- ✅ Friendly UI in QuickSight console
- ✅ Straightforward implementation

**User/Group-based RLS** (Dataset-based):
- ❌ Requires creating a separate RLS DataSet
- ❌ Must follow specific CSV format: `GroupName,UserName,field1,field2,field3...`
- ❌ Manual CSV file updates for each change
- ❌ Difficult to maintain in external databases (requires dynamic views)
- ❌ Schema changes require DataSet updates
- ❌ No version control or audit trail
- ❌ Error-prone manual process

See [AWS Documentation](https://docs.aws.amazon.com/quicksight/latest/user/restrict-access-to-a-data-set-using-row-level-security.html) for details on RLS format requirements.

## The Solution

The **QuickSight RLS Manager** provides:

✅ **Intuitive UI** for administrators to create and manage permissions
✅ **Automated workflow** - all underlying resources and changes handled automatically
✅ **Version control** - track changes and rollback when needed
✅ **Audit trail** - complete history of permission changes
✅ **Multi-region support** - manage RLS across multiple AWS regions
✅ **Centralized management** - single interface for all DataSets
✅ **Error handling** - comprehensive validation and error recovery
✅ **Infrastructure as Code** - built with [AWS Amplify](https://docs.amplify.aws/react/)

### How It Works

1. **Create Permissions** - Define who can see what data using a simple UI
2. **Publish** - Click publish and the tool automatically:
   - Generates the CSV file
   - Uploads to S3
   - Creates/updates Glue table
   - Creates/updates RLS DataSet
   - Applies RLS to your main DataSet
3. **Monitor** - Track ingestion status and verify success
4. **Rollback** - Revert to previous versions if needed

## Core Concepts

Understanding these key concepts is essential for using the RLS Manager effectively:

### DataSet Types

**Main DataSet** (DataSet to be Secured):
- The QuickSight DataSet containing your business data
- The DataSet you want to protect with RLS
- Users will see filtered rows based on RLS rules
- Example: Sales data, customer information, financial reports

**RLS DataSet**:
- A special DataSet containing permission rules
- Defines who can see which rows in the Main DataSet
- Created and managed automatically by the RLS Manager
- Format: `UserName,GroupName,field1,field2,field3...`
- Tagged with `RLS-Manager: True` for identification

### Key Terms

**Management Region**:
- The AWS region where QuickSight users, groups, and authentication are managed
- Typically `us-east-1` or your primary QuickSight region
- Set during initial configuration

**Managed Region**:
- AWS regions where you want to manage RLS DataSets
- Can be different from the Management Region
- Each region has its own S3 bucket, Glue database, and DataSource
- Multiple regions can be managed simultaneously

**Permission**:
- A single rule defining access for a user/group to specific data
- Stored as individual rows in DynamoDB
- Combined into CSV format when publishing to QuickSight
- Example: "User john@example.com can see Region=US"

**Publishing**:
- The process of applying permissions to QuickSight
- Involves 6 automated steps (validation, S3, Glue, RLS DataSet, apply, verify)
- Creates a new version for audit and rollback purposes

## Architecture

The RLS Manager is built using AWS Amplify and leverages multiple AWS services to provide a complete, scalable solution.

### AWS Services Used

**Data Storage & Management**:
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) - Stores permissions, DataSet metadata, and configuration
- [Amazon S3](https://aws.amazon.com/pm/serv-s3/) - Stores RLS CSV files with versioning enabled
- [AWS Glue](https://aws.amazon.com/glue/) - Data Catalog for RLS table metadata

**Data Processing & Query**:
- [Amazon Athena](https://aws.amazon.com/athena/) - Queries Glue tables (via QuickSight DataSource)
- [AWS Lambda](https://aws.amazon.com/lambda/) - 27 functions for automation and orchestration
- [Amazon QuickSight](https://aws.amazon.com/quicksight/) - Business intelligence and RLS application

**Security & Authentication**:
- [Amazon Cognito](https://aws.amazon.com/cognito/) - User authentication and authorization
- [AWS IAM](https://aws.amazon.com/iam/) - Service permissions and roles

**Monitoring & Logging**:
- [Amazon CloudWatch](https://aws.amazon.com/cloudwatch/) - Logs, metrics, and SPICE capacity monitoring

### Architecture Diagram

![Architecture](/Guide/images/RLS-Tool-Architecture.png)

### Data Flow

1. **User creates permissions** → Stored in DynamoDB
2. **User clicks publish** → Lambda workflow triggered
3. **CSV generated** → Uploaded to S3 with versioning
4. **Glue table created/updated** → Metadata for CSV structure
5. **RLS DataSet created/updated** → QuickSight DataSet via Athena
6. **RLS applied** → Main DataSet linked to RLS DataSet
7. **SPICE ingestion** → Data loaded into QuickSight
8. **Users access data** → See only permitted rows

For detailed architecture information, see [RLS Manager Resources](Amplify-Resources.md).

## Guide Structure

This comprehensive guide is organized into the following sections:

### 🚀 Getting Started
* [**Installation Guide**](Install.md) - Step-by-step installation instructions
* [**Initialization Guide**](Initialization.md) - Initial setup and configuration
* [**Quick Start Tutorial**](#quick-start) - Get up and running in 15 minutes

### 📋 User Guides
* [**Managing Permissions**](Manage-Permissions.md) - Create, edit, and publish RLS permissions
* [**Multi-Region Setup**](#multi-region-management) - Managing RLS across multiple AWS regions
* [**Version Management**](#version-control) - Track changes and rollback when needed

### 🔧 Technical Documentation
* [**Amplify Resources**](Amplify-Resources.md) - Detailed AWS resources and data models
* [**Lambda Functions**](Amplify-Resources.md#lambda-functions) - Complete function documentation (27 functions)
* [**API Reference**](#api-reference) - GraphQL schema and operations
* [**Troubleshooting Guide**](#troubleshooting) - Common issues and solutions

### 🏗️ Advanced Topics
* [**Architecture Deep Dive**](#architecture-deep-dive) - Detailed system architecture
* [**Security Best Practices**](#security) - IAM roles, permissions, and security
* [**Performance Optimization**](#performance) - SPICE capacity and optimization tips
* [**Monitoring & Logging**](#monitoring) - CloudWatch integration and debugging

### 📚 Reference
* [**FAQ**](#frequently-asked-questions) - Common questions and answers
* [**Glossary**](#glossary) - Key terms and definitions
* [**Release Notes**](#release-notes) - Version history and changes

## Workflow Overview

The RLS Manager follows a simple, intuitive workflow:

### 1. 📝 Create Permissions
- Define who (users/groups) can see what data (field values)
- Use the intuitive web interface
- Permissions are stored in DynamoDB
- Status: `PENDING` (not yet applied to QuickSight)

### 2. 🚀 Publish to QuickSight
- Click "Publish" to apply permissions
- Automated 6-step workflow executes
- Each step is a separate Lambda function for reliability
- Status updates to `PUBLISHED` on success

### 3. ✅ Verify Results
- Monitor SPICE ingestion progress
- Test with different users to verify RLS works
- Check audit logs and version history

## Publishing Workflow (6 Steps)

The **Publish** operation is fully automated and consists of:

### Step 0: 🔍 Validation (`publishRLS00ResourcesValidation`)
- Verify all AWS resources exist (S3 bucket, Glue database, QuickSight DataSource)
- Check IAM permissions
- Validate DataSet is manageable via API
- **Duration**: ~5 seconds

### Step 1: 📁 S3 Upload (`publishRLS01S3`)
- Generate CSV file from permissions
- Upload to S3 with versioning
- Validate CSV headers and format
- **Duration**: ~10 seconds

### Step 2: 🗃️ Glue Table (`publishRLS02Glue`)
- Create or update Glue table metadata
- Define schema for CSV structure
- Configure SerDe for CSV parsing
- **Duration**: ~15 seconds

### Step 3: 📊 RLS DataSet (`publishRLS03QsRLSDataSet`)
- Create or update QuickSight RLS DataSet
- Connect to Glue table via Athena
- Configure SPICE ingestion
- **Duration**: ~30 seconds (may trigger ingestion)

### Step 4: 🔗 Apply RLS (`publishRLS04QsUpdateMainDataSetRLS`)
- Link RLS DataSet to Main DataSet
- Preserve all existing DataSet settings
- Handle both legacy and new data prep experiences
- **Duration**: ~20 seconds (may trigger ingestion)

### Step 99: ⏳ Check Ingestion (`publishRLS99QsCheckIngestion`)
- Monitor SPICE ingestion progress
- Wait for completion (if needed)
- Verify successful data load
- **Duration**: 0-300 seconds (depends on data size)

### Total Time
- **Minimum**: ~80 seconds (no ingestion needed)
- **Typical**: 2-5 minutes (with SPICE ingestion)
- **Maximum**: 10 minutes (large datasets)

### Error Handling
- Each step has comprehensive error handling
- Failed steps don't affect previous successful steps
- Detailed error messages for troubleshooting
- Automatic retry logic for transient failures
- Version history preserved even on failures

## Quick Start

Get up and running with RLS Manager in 15 minutes:

### Prerequisites
- AWS Account with QuickSight enabled
- QuickSight Enterprise edition (required for RLS)
- Node.js 18+ and npm installed
- AWS CLI configured
- Git installed

### 5-Minute Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd quicksight-rls-manager
   npm install
   ```

2. **Deploy to AWS**
   ```bash
   npx amplify configure
   npx amplify init
   npx amplify push
   ```

3. **Initialize Configuration**
   - Open the deployed web application
   - Set your QuickSight Management Region
   - Add your first Managed Region
   - Import existing DataSets

4. **Create Your First Permission**
   - Select a DataSet
   - Choose a user or group
   - Define field-level permissions
   - Click "Publish"

5. **Verify Results**
   - Monitor the publishing workflow
   - Test with different users
   - Check QuickSight console

### Next Steps
- Read the [Managing Permissions](Manage-Permissions.md) guide
- Explore [Advanced Features](#key-features)
- Set up [Monitoring](#troubleshooting)

## Key Features

### 🎯 Core Capabilities
- **Visual Permission Management** - Intuitive UI for creating and editing RLS rules
- **Automated Publishing** - One-click deployment to QuickSight
- **Multi-Region Support** - Manage RLS across multiple AWS regions
- **Version Control** - Track changes and rollback when needed
- **Audit Trail** - Complete history of all permission changes
- **Error Recovery** - Comprehensive error handling and retry logic

### 🔧 Advanced Features
- **Bulk Operations** - Import/export permissions via CSV
- **Permission Templates** - Reusable permission patterns
- **User/Group Sync** - Automatic synchronization with QuickSight
- **SPICE Monitoring** - Real-time capacity and ingestion tracking
- **API Access** - GraphQL API for programmatic management
- **Webhook Integration** - Notifications for permission changes

### 🛡️ Security & Compliance
- **IAM Integration** - Fine-grained AWS permissions
- **Encryption** - Data encrypted at rest and in transit
- **Access Logging** - CloudTrail integration for compliance
- **Role-Based Access** - Different permission levels for users
- **Data Residency** - Regional data storage compliance

## Multi-Region Management

The RLS Manager supports managing RLS across multiple AWS regions:

### Management Region
- **Purpose**: Where QuickSight users, groups, and authentication are managed
- **Typically**: `us-east-1` (QuickSight's primary region)
- **Contains**: User directory, group definitions, authentication settings

### Managed Regions
- **Purpose**: Where your DataSets and RLS rules are deployed
- **Can be**: Any AWS region where QuickSight is available
- **Contains**: S3 buckets, Glue databases, DataSources, DataSets

### Setup Process
1. **Configure Management Region** during initialization
2. **Add Managed Regions** as needed
3. **Deploy Resources** automatically created per region
4. **Manage Permissions** centrally across all regions

### Benefits
- **Data Locality** - Keep data in required regions for compliance
- **Performance** - Reduce latency by keeping data close to users
- **Disaster Recovery** - Distribute RLS across multiple regions
- **Cost Optimization** - Use different regions for cost efficiency

## Version Control

Every permission change is tracked with full version control:

### Automatic Versioning
- **Version Numbers** - Incremental version numbers (1, 2, 3...)
- **Timestamps** - When each version was published
- **S3 Versioning** - Complete CSV file history
- **Metadata** - Who published, permission count, status

### Rollback Capabilities
- **One-Click Rollback** - Revert to any previous version
- **Preview Before Rollback** - See exactly what will change
- **Safe Rollback** - Creates new version (doesn't delete history)
- **Audit Trail** - Track all rollback operations

### Version Management
```
Version 3 (Current) - 2024-01-15 10:30 AM - 150 permissions ✓
Version 2           - 2024-01-14 02:15 PM - 145 permissions ✓
Version 1           - 2024-01-10 09:00 AM - 120 permissions ✓
```

## Troubleshooting

### Common Issues

**Publishing Fails at Step 0 (Validation)**
- Check AWS resources exist (S3 bucket, Glue database, DataSource)
- Verify IAM permissions
- Ensure QuickSight is enabled

**Publishing Fails at Step 3 (RLS DataSet)**
- Check SPICE capacity availability
- Verify DataSource connectivity
- Ensure Glue table is accessible

**RLS Not Working After Publishing**
- Wait for SPICE ingestion to complete
- Verify user names match exactly
- Check permission field values
- Test with QuickSight console

**Performance Issues**
- Monitor SPICE capacity usage
- Optimize permission rules
- Consider Direct Query for large datasets
- Review CloudWatch metrics

### Getting Help
- Check the [detailed troubleshooting guides](Amplify-Resources.md#lambda-functions) for each function
- Review CloudWatch logs for specific errors
- Use the built-in error recovery features
- Contact support with specific error messages

## Frequently Asked Questions

**Q: What QuickSight edition is required?**
A: QuickSight Enterprise edition is required for Row-Level Security features.

**Q: Can I manage multiple AWS accounts?**
A: Currently, the solution manages one AWS account. Multi-account support is planned for future releases.

**Q: How much does it cost to run?**
A: Costs include AWS services (Lambda, DynamoDB, S3, Glue) plus QuickSight SPICE capacity. Typical monthly cost is $50-200 depending on usage.

**Q: Can I use this with existing DataSets?**
A: Yes! The solution works with existing QuickSight DataSets. It preserves all existing settings when applying RLS.

**Q: What happens if I delete the RLS Manager?**
A: RLS rules remain active in QuickSight. You can manage them manually or reinstall the RLS Manager to regain automated management.

**Q: Can I export/import permissions?**
A: Yes, permissions can be exported to CSV and imported back. This is useful for bulk operations and backups.

## Glossary

**DataSet** - A QuickSight DataSet containing business data
**RLS DataSet** - A special DataSet containing permission rules
**Management Region** - AWS region where QuickSight users/groups are managed
**Managed Region** - AWS region where DataSets and RLS are deployed
**Permission** - A rule defining user/group access to specific data
**Publishing** - The process of applying permissions to QuickSight
**SPICE** - QuickSight's in-memory calculation engine
**Version** - A snapshot of permissions at a point in time

## Known Limitations

* The Solution lets you manage a single QuickSight Account
* The DataSets created by directly uploading a file into QuickSight cannot be managed by RLS Manager
* The *date* fields are not valid in RLS

## Future Enhancements

- Multi-account support
- Enhanced permission templates
- Advanced analytics and reporting
- Integration with external identity providers
- Automated testing and validation tools

---

## Next Steps

Ready to get started? Follow these guides in order:

1. 📦 [**Installation**](Install.md) - Install and deploy the solution
2. ⚙️ [**Initialization**](Initialization.md) - Configure your first region
3. 🔐 [**Managing Permissions**](Manage-Permissions.md) - Create and publish RLS rules
4. 🏗️ [**Advanced Configuration**](Amplify-Resources.md) - Deep dive into architecture

**Need help?** Check the troubleshooting sections in each guide or review the [Lambda function documentation](Amplify-Resources.md#lambda-functions) for detailed technical information.