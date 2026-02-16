import styled from 'styled-components';

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xxs};
  border-radius: ${({ theme }) => theme.radius.pill};
  padding: ${({ theme }) => `${theme.spacing.xxs} ${theme.spacing.sm}`};
  background: ${({ theme }) => theme.color.surfaceMuted};
  border: 1px solid ${({ theme }) => theme.color.border};
  color: ${({ theme }) => theme.color.textMuted};
  font-size: 0.82rem;
  font-weight: 600;
`;
