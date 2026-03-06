import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EcoSquadStack } from '../lib/eco-squad-stack';

describe('EcoSquadStack Snapshot', () => {
  it('should match the snapshot', () => {
    const app = new cdk.App();
    const stack = new EcoSquadStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'eu-west-1',
      },
    });
    
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
