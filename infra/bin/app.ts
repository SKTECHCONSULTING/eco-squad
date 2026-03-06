#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcoSquadStack } from '../lib/eco-squad-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
  region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
};

new EcoSquadStack(app, 'EcoSquadStack', { env });

app.synth();
