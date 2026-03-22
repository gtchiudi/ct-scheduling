export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone) => {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 0 || digitsOnly.length === 10;
};
