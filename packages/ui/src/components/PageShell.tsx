import styled from 'styled-components';

export const PageShell = styled.main`
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.spacing.xl} 0`};
`;
