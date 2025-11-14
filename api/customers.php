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
        $search = $_GET['search'] ?? '';
        
        if ($search) {
            $query = "SELECT * FROM customers WHERE name LIKE :search OR phone LIKE :search OR email LIKE :search ORDER BY created_at DESC";
            $stmt = $db->prepare($query);
            $searchParam = "%$search%";
            $stmt->bindParam(':search', $searchParam);
        } else {
            $query = "SELECT * FROM customers ORDER BY created_at DESC";
            $stmt = $db->prepare($query);
        }
        
        $stmt->execute();
        $customers = $stmt->fetchAll();
        
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $customers]);
        break;
        
    case 'POST':
        $data = $input;
        
        $query = "INSERT INTO customers (name, phone, email, document, address, notes, total_purchases, created_by) 
                  VALUES (:name, :phone, :email, :document, :address, :notes, :total_purchases, :created_by)";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':document', $data['document']);
        $stmt->bindParam(':address', $data['address']);
        $stmt->bindParam(':notes', $data['notes']);
        $total_purchases = $data['totalPurchases'] ?? 0;
        $stmt->bindParam(':total_purchases', $total_purchases);
        $stmt->bindParam(':created_by', $_SESSION['user_email']);
        
        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error al crear cliente']);
        }
        break;
        
    case 'PUT':
        $id = $_GET['id'] ?? null;
        $data = $input;
        
        $query = "UPDATE customers SET name = :name, phone = :phone, email = :email, 
                  document = :document, address = :address, notes = :notes, total_purchases = :total_purchases 
                  WHERE id = :id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':document', $data['document']);
        $stmt->bindParam(':address', $data['address']);
        $stmt->bindParam(':notes', $data['notes']);
        $stmt->bindParam(':total_purchases', $data['totalPurchases']);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false]);
        }
        break;
        
    case 'DELETE':
        $id = $_GET['id'] ?? null;
        
        $query = "DELETE FROM customers WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
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
