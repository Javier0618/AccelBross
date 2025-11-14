<?php
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch($method) {
    case 'GET':
        $query = "SELECT * FROM settings LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $settings = $stmt->fetch();
        
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $settings]);
        break;
        
    case 'PUT':
        $data = $input;
        
        // Verificar si existe configuración
        $checkQuery = "SELECT id FROM settings LIMIT 1";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute();
        
        if ($checkStmt->rowCount() > 0) {
            $settings = $checkStmt->fetch();
            $query = "UPDATE settings SET company_name = :company_name, company_nit = :company_nit, 
                      company_address = :company_address, logo_url = :logo_url, tax_rate = :tax_rate, 
                      currency = :currency, min_stock = :min_stock WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id', $settings['id']);
        } else {
            $query = "INSERT INTO settings (company_name, company_nit, company_address, logo_url, tax_rate, currency, min_stock) 
                      VALUES (:company_name, :company_nit, :company_address, :logo_url, :tax_rate, :currency, :min_stock)";
            $stmt = $db->prepare($query);
        }
        
        $stmt->bindParam(':company_name', $data['companyName']);
        $stmt->bindParam(':company_nit', $data['companyNIT']);
        $stmt->bindParam(':company_address', $data['companyAddress']);
        $stmt->bindParam(':logo_url', $data['logoURL']);
        $stmt->bindParam(':tax_rate', $data['taxRate']);
        $stmt->bindParam(':currency', $data['currency']);
        $stmt->bindParam(':min_stock', $data['minStock']);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false]);
        }
        break;
}
?>
