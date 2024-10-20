This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```


Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## S3 Storage Functionality

This project includes functionality to store conversation history in AWS S3. Follow these steps to set up S3 data storage:

### Required Environment Variables

Set the following environment variables in your `.env` file to enable S3 storage:

- `NEXT_PUBLIC_AWS_ACCESS_KEY_ID`: Your AWS account access key ID.
- `NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY`: Your AWS account secret access key.
- `NEXT_PUBLIC_AWS_REGION`: The AWS region you're using (e.g., `us-west-1`).
- `NEXT_PUBLIC_AWS_BUCKET_NAME`: The name of the S3 bucket to store data.
- `NEXT_PUBLIC_NG_LIST_TABLE_NAME`: The name of the DynamoDB table for storing NG words (e.g., `InfraStack-UserNGWordsTableF22BCCB6-5JOHMXCQINVI`).

### DynamoDB Table Configuration

For structured data storage and quick access to summaries:

- `NEXT_PUBLIC_CONVERSATION_TABLE_NAME`: The name of your DynamoDB table for storing individual conversations (e.g., `InfraStack-ConversationTable75C14D21-CBF8FHFWTFR9`).
- `NEXT_PUBLIC_DAILY_SUMMARY_TABLE_NAME`: The name of your DynamoDB table for storing daily summaries (e.g., `InfraStack-DailySummaryTableE74D04F1-X1QZ0S58853E`).
- `NEXT_PUBLIC_MONTHLY_SUMMARY_TABLE_NAME`: The name of your DynamoDB table for storing monthly summaries (e.g., `InfraStack-MonthlySummaryTable3C678C5E-ZS4E8P7DZOV2`).

These DynamoDB tables store processed and summarized data for efficient querying and display in the parent console.


### Important Notes

- Ensure that your AWS credentials have the necessary permissions to access and modify the specified S3 bucket and DynamoDB tables.
- The S3 bucket should be configured with appropriate security settings to protect sensitive conversation data.
- Regular backups of both S3 and DynamoDB data are recommended to prevent data loss.
