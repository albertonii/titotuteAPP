// Simple tests for the Performance Tracker
// Run these tests by opening test.html in a browser and checking the console

function runTests() {
    console.log('=== Starting Performance Tracker Tests ===');
    
    // Test 1: PerformanceTracker initialization
    console.log('\nTest 1: Initialize PerformanceTracker');
    try {
        localStorage.clear(); // Clear any existing data
        const testTracker = new PerformanceTracker();
        console.assert(testTracker.performances.length === 0, 'Initial performances should be empty');
        console.log('✓ Test 1 passed');
    } catch (e) {
        console.error('✗ Test 1 failed:', e);
    }
    
    // Test 2: Add performance
    console.log('\nTest 2: Add a performance record');
    try {
        const testTracker = new PerformanceTracker();
        const initialCount = testTracker.performances.length;
        
        const testPerformance = {
            id: Date.now(),
            subject: 'Test Subject',
            topic: 'Test Topic',
            duration: 30,
            exercises: 5,
            score: 8.5,
            notes: 'Test notes',
            date: new Date().toISOString()
        };
        
        testTracker.addPerformance(testPerformance);
        console.assert(testTracker.performances.length === initialCount + 1, 'Performance should be added');
        console.assert(testTracker.performances[0].subject === 'Test Subject', 'Subject should match');
        console.log('✓ Test 2 passed');
    } catch (e) {
        console.error('✗ Test 2 failed:', e);
    }
    
    // Test 3: Delete performance
    console.log('\nTest 3: Delete a performance record');
    try {
        const testTracker = new PerformanceTracker();
        const testPerformance = {
            id: 12345,
            subject: 'Test Subject',
            topic: 'Test Topic',
            duration: 30,
            exercises: 5,
            score: 8.5,
            notes: 'Test notes',
            date: new Date().toISOString()
        };
        
        testTracker.addPerformance(testPerformance);
        const countBefore = testTracker.performances.length;
        testTracker.deletePerformance(12345);
        console.assert(testTracker.performances.length === countBefore - 1, 'Performance should be deleted');
        console.log('✓ Test 3 passed');
    } catch (e) {
        console.error('✗ Test 3 failed:', e);
    }
    
    // Test 4: Local storage persistence
    console.log('\nTest 4: LocalStorage persistence');
    try {
        localStorage.clear();
        const testTracker1 = new PerformanceTracker();
        
        const testPerformance = {
            id: Date.now(),
            subject: 'Persistent Test',
            topic: 'Storage Test',
            duration: 45,
            exercises: 10,
            score: 9.0,
            notes: 'Testing persistence',
            date: new Date().toISOString()
        };
        
        testTracker1.addPerformance(testPerformance);
        
        // Create new instance to test loading from storage
        const testTracker2 = new PerformanceTracker();
        console.assert(testTracker2.performances.length === 1, 'Should load from localStorage');
        console.assert(testTracker2.performances[0].subject === 'Persistent Test', 'Data should persist');
        console.log('✓ Test 4 passed');
    } catch (e) {
        console.error('✗ Test 4 failed:', e);
    }
    
    // Test 5: HTML escaping
    console.log('\nTest 5: HTML escaping for security');
    try {
        const testTracker = new PerformanceTracker();
        const escaped = testTracker.escapeHtml('<script>alert("XSS")</script>');
        console.assert(!escaped.includes('<script>'), 'HTML should be escaped');
        console.assert(escaped.includes('&lt;script&gt;'), 'Should contain escaped HTML');
        console.log('✓ Test 5 passed');
    } catch (e) {
        console.error('✗ Test 5 failed:', e);
    }
    
    // Test 6: Date formatting
    console.log('\nTest 6: Date formatting');
    try {
        const testTracker = new PerformanceTracker();
        const testDate = new Date('2025-11-11T12:00:00.000Z');
        const formatted = testTracker.formatDate(testDate.toISOString());
        console.assert(typeof formatted === 'string', 'Should return a string');
        console.assert(formatted.length > 0, 'Should not be empty');
        console.log('✓ Test 6 passed');
    } catch (e) {
        console.error('✗ Test 6 failed:', e);
    }
    
    console.log('\n=== All Tests Completed ===');
    
    // Clean up
    localStorage.clear();
}

// Run tests when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
} else {
    runTests();
}
