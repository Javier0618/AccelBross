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
        $category = $_GET['category'] ?? '';
        
        if ($category) {
            $query = "SELECT * FROM expenses WHERE category = :category ORDER BY expense_date DESC";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':category', $category);
        } else {
            $query = "SELECT * FROM expenses ORDER BY expense_date DESC";
            $stmt = $db->prepare($query);
        }
        
        $stmt->execute();
        $expenses = $stmt->fetchAll();
        
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $expenses]);
        break;
        
    case 'POST':
        $data = $input;
        
        $query = "INSERT INTO expenses (concept, amount, category, expense_date, description, created_by) 
                  VALUES (:concept, :amount, :category, :expense_date, :description, :created_by)";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':concept', $data['concept']);
        $stmt->bindParam(':amount', $data['amount']);
        $stmt->bindParam(':category', $data['category']);
        $stmt->bindParam(':expense_date', $data['date']);
        $stmt->bindParam(':description', $data['description']);
        $stmt->bindParam(':created_by', $_SESSION['user_email']);
        
        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false]);
        }
        break;
        
    case 'PUT':
        $id = $_GET['id'] ?? null;
        $data = $input;
        
        $query = "UPDATE expenses SET concept = :concept, amount = :amount, category = :category, 
                  expense_date = :expense_date, description = :description WHERE id = :id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':concept', $data['concept']);
        $stmt->bindParam(':amount', $data['amount']);
        $stmt->bindParam(':category', $data['category']);
        $stmt->bindParam(':expense_date', $data['date']);
        $stmt->bindParam(':description', $data['description']);
        
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
        
        $query = "DELETE FROM expenses WHERE id = :id";
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
