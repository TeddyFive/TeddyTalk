# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## AWS Setup

### AWS IoT Core Setup(Not Required if using S3 for file upload)
execute the following command to create a certificate and keys.
``` bash
# Create a certificate and keys
aws iot create-keys-and-certificate \
    --set-as-active \
    --certificate-pem-outfile certificate_filename.pem \
    --public-key-outfile public_filename.key \
    --private-key-outfile private_filename.key

# Download the Amazon Root CA certificate
wget https://www.amazontrust.com/repository/AmazonRootCA1.pem -O AmazonRootCA1.pem
```

set the certificate ARN to the .env file.
```
IOT_CERTIFICATE_ARN=arn:aws:iot:xxxxxxxxxxxxxxxx:cert/xxxxxxxxxxxxxxxx
```

### Deploy the infrastructure
execute the following command to deploy the infrastructure.
``` bash
cd infra
cdk bootstrap aws://{your-account-id}/{your-region}
cdk deploy
```