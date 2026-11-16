// كود مكوّن من 6 أرقام
export const generateActivationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
