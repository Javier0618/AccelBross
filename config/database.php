<?php
class Database {
    private $host = 'localhost';
    private $db_name = 'accelbross_erp';
    private $username = 'root'; // Cambiar según tu configuración
    private $password = 'tu_password'; // Cambiar según tu configuración
    private $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
                $this->username,
                $this->password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        } catch(PDOException $e) {
            error_log("Connection error: " . $e->getMessage());
            throw new Exception("Database connection failed");
        }
        return $this->conn;
    }
}

// Configuración CORS y headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Manejar preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Helper function para obtener el usuario actual desde el token
function getCurrentUser() {
    $headers = getallheaders();
    $token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : null;
    
    if (!$token) {
        return null;
    }
    
    // Decodificar token JWT (implementar según tu método de autenticación)
    // Por simplicidad, aquí usamos sesiones
    session_start();
    return isset($_SESSION['user_email']) ? $_SESSION['user_email'] : null;
}
?>
