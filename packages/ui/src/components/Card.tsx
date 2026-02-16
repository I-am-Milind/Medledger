import styled from 'styled-components';

export const Card = styled.section`
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  padding: ${({ theme }) => theme.spacing.lg};
`;
