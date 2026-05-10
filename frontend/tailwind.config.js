export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        grass: {
          50: '#F0FCF3',
          100: '#DCF8E4',
          200: '#B8EFC5',
          300: '#8DDBA2',
          400: '#5FC573',
          500: '#4BAC52',
          600: '#429043',
          700: '#357237',
          800: '#2C5A2D',
          900: '#214224'
        }
      },
      boxShadow: {
        soft: '0 26px 60px rgba(76, 175, 80, 0.16)'
      },
      fontFamily: {
        display: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
