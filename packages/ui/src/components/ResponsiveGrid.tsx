import styled from 'styled-components';

type ResponsiveGridProps = {
  minColumnWidth?: string;
};

export const ResponsiveGrid = styled.div<ResponsiveGridProps>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${({ minColumnWidth = '240px' }) => minColumnWidth}, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
`;
