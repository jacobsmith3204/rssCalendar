import Tesseract from 'tesseract.js';
import path from 'path';

// Path to the image file
const imagePath = path.join(__dirname, 'test.png');

Tesseract.recognize(
    imagePath,               // Image file path
    'eng',                   // Language (English in this case)
    {
        logger: m => console.log(m) // Log progress
    }
).then(({ data: { text } }) => {
    console.log('Recognized text:', text);
}).catch(error => {
    console.error('Error:', error);
});
