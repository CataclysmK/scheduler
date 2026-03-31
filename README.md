# My Schedule Site

## Overview
My Schedule Site is a static web application designed to display work schedules for employees. The application provides functionalities to view current shifts, check shifts for specific days, and view schedules by week or month.

## Features
- Display who is currently on shift.
- View shifts for a specific day selected by the user.
- View schedules by week or month based on user selection.

## Project Structure
```
my-schedule-site
├── src
│   ├── index.html        # Main HTML document
│   ├── styles.css       # Styles for the web application
│   ├── app.js           # Main JavaScript file for application logic
│   ├── data
│   │   └── schedule.json # JSON file containing schedule data
│   └── components
│       ├── current-shift.js  # Component for displaying current shift
│       ├── day-view.js       # Component for displaying daily schedule
│       └── week-month-view.js # Component for displaying weekly/monthly schedule
├── package.json          # npm configuration file
└── README.md             # Project documentation
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd my-schedule-site
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Usage
1. Open `src/index.html` in a web browser to view the application.
2. Use the interface to navigate through the current shifts, daily schedules, and weekly/monthly views.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.