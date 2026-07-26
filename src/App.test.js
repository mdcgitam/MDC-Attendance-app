import { render, screen } from '@testing-library/react';
import App from './ClubPortal';

test('renders MDC Portal login heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/MDC Portal/i);
  expect(headingElement).toBeInTheDocument();
});
