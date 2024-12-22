#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server details
const char* serverUrl = "YOUR_JSON_SERVER_URL";

// Pin definitions
const int DOOR_SENSOR_PIN = 4;    // Door sensor pin
const int FLOW_SENSOR_PIN = 5;    // Flow sensor pin

// Variables
String vehicleNumber = "";        // Will be set from server
volatile unsigned long flowCount = 0;
unsigned long lastFlowCheck = 0;
const int FLOW_CHECK_INTERVAL = 1000;  // Check flow every second

void IRAM_ATTR flowPulseCounter() {
    flowCount++;
}

void setup() {
    Serial.begin(115200);

    pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
    pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
    
    attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), flowPulseCounter, RISING);

    // Connect to WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi Connected!");

    // Get vehicle number from server
    fetchVehicleNumber();
}

void loop() {
    static unsigned long lastFlow = 0;
    unsigned long currentFlow = flowCount;
    int flowRate = currentFlow - lastFlow;
    lastFlow = currentFlow;

    // Read door sensor
    bool doorOpen = !digitalRead(DOOR_SENSOR_PIN);

    // Send data to server
    sendDataToServer(doorOpen, flowRate);

    delay(1000);  // Update every second
}

void fetchVehicleNumber() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(String(serverUrl) + "/vehicle/" + WiFi.macAddress());
        int httpCode = http.GET();

        if (httpCode > 0) {
            String payload = http.getString();
            DynamicJsonDocument doc(1024);
            deserializeJson(doc, payload);
            vehicleNumber = doc["vehicleNumber"].as<String>();
        }
        http.end();
    }
}

void sendDataToServer(bool doorOpen, int flowRate) {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(String(serverUrl) + "/sensor-data");
        http.addHeader("Content-Type", "application/json");

        DynamicJsonDocument doc(1024);
        doc["vehicleNumber"] = vehicleNumber;
        doc["doorStatus"] = doorOpen ? 1 : 0;
        doc["flowRate"] = flowRate;
        doc["timestamp"] = millis();

        String jsonString;
        serializeJson(doc, jsonString);

        int httpResponseCode = http.POST(jsonString);
        if (httpResponseCode > 0) {
            Serial.printf("Data sent. Response: %d\n", httpResponseCode);
        } else {
            Serial.printf("Error: %d\n", httpResponseCode);
        }
        http.end();
    }
}
