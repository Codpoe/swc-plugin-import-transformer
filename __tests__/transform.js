/**
 * import { Button } from 'antd'
 * ↓↓↓
 * import Button from 'antd/es/button'
 */
module.exports = ({ name }) => {
  return `antd/es/${name.toLowerCase()}`;
};
