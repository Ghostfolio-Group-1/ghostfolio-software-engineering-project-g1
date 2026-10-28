import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from './button';

describe('Button', () => {
  it('should render a primary button by default', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);

    expect(html).toContain('type="button"');
    expect(html).toContain('background-color:#36cfcc');
    expect(html).toContain('>Save</button>');
  });

  it('should render a transparent secondary button', () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary">Cancel</Button>
    );

    expect(html).toContain('background-color:transparent');
  });

  it('should dim and disable a disabled button', () => {
    const html = renderToStaticMarkup(<Button disabled>Save</Button>);

    expect(html).toContain('disabled=""');
    expect(html).toContain('opacity:0.5');
  });
});
