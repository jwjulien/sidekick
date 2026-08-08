import { render } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';

describe('Example Test', () => {
  it('should render and pass', () => {
    const { container } = render(() => <div>Hello Test</div>);
    expect(container).toHaveTextContent('Hello Test');
  });
});
