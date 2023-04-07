export function isBlank(str) {
    return (!str || /^\s*$/.test(str));
}
const formatNumber = n => {
    n = n.toString()
    return n[1] ? n : `0${n}`
}
export const formatTime = date => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const seconds = date.getSeconds()
  
    return `${[year, month, day].map(formatNumber).join('')}_${[hour, minute, seconds].map(formatNumber).join('')}`
}

export const getTimeStamp = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2,'0');
    const day = String(date.getDate()).padStart(2,'0');
    const hour = String(date.getHours()).padStart(2,'0');
    const minute = String(date.getMinutes()).padStart(2,'0');
    const seconds = String(date.getSeconds()).padStart(2,'0');
    const msSeconds = String(date.getMilliseconds()).padStart(3,'0');
  
    return `${year}-${month}-${day}T${hour}:${minute}:${seconds}.${msSeconds}`;
}