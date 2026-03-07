import { render, screen } from '@testing-library/react';
import React from 'react';

// Simple test to verify Jest setup works
describe('Jest Setup', () => {
  it('should run tests correctly', () => {
    expect(true).toBe(true);
  });

  it('should render a simple component', () => {
    const TestComponent: React.FC = () => <div data-testid="test">Hello EcoSquad</div>;
    render(<TestComponent />);
    expect(screen.getByTestId('test')).toHaveTextContent('Hello EcoSquad');
  });
});
