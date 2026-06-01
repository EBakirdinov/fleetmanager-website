<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Routing\Annotation\Route;
use App\Service\AccountService;

class SecurityController extends AbstractController
{
    /**
     * @Route("/signup", methods={"GET", "POST"}, name="signup")
     */
    public function signup(Request $request, SessionInterface $session, AccountService $accountService): Response
    {
        if ($request->isXmlHttpRequest()) {
            $postArray = $request->request->all();

            $data = array();
            if (!empty($postArray['email'])) {
                $data['email'] = trim($postArray['email']);
            }

            if (!empty($postArray['password'])) {
                $data['password'] = trim($postArray['password']);
            }

            $registerResponse = $accountService->register($data);

            if (isset($registerResponse['token'])) {
                $token = $registerResponse['token'];

                $return = array(
                    'result' => true
                );

                $response = new JsonResponse($return);

                // store JWT token to session
                $session->set('stoken', $token);

                $encryptedToken = $accountService->encryptLoginToken($token);
                $loginCookie = new Cookie('scheduler_rememberme', $encryptedToken, time() + (3600 * 10));
        
                $response->headers->setCookie($loginCookie);

                return $response;
            }
            else {
                $return = array('result' => false, 'error' => $registerResponse['message']);
                return new JsonResponse($return);
            }
        }

        return $this->render('security/signup.html.twig', [

        ]);
    }

    /**
     * @Route("/signin", methods={"GET", "POST"}, name="signin")
     */
    public function signin(Request $request, SessionInterface $session, AccountService $accountService): Response
    {
        if ($request->isXmlHttpRequest()) {
            $postArray = $request->request->all();

            $data = array();
            if (!empty($postArray['email'])) {
                $data['username'] = trim($postArray['email']);
            }

            if (!empty($postArray['password'])) {
                $data['password'] = trim($postArray['password']);
            }

            $loginResponse = $accountService->login($data);

            if (isset($loginResponse['token'])) {
                $token = $loginResponse['token'];

                $return = array(
                    'result' => true
                );

                $response = new JsonResponse($return);

                // store JWT token to session
                $session->set('stoken', $token);

                $encryptedToken = $accountService->encryptLoginToken($token);
                $loginCookie = new Cookie('scheduler_rememberme', $encryptedToken, time() + (3600 * 10));
        
                $response->headers->setCookie($loginCookie);

                return $response;
            }
            else {
                $return = array('result' => false, 'error' => $loginResponse['message']);
                return new JsonResponse($return);
            }
        }

        return $this->render('security/signin.html.twig', [

        ]);
    }

    /**
     * @Route("/forgot_password", methods={"GET", "POST"}, name="forgot_password")
     */
    public function forgot_password(Request $request, SessionInterface $session, AccountService $accountService): Response
    {
        if ($request->isXmlHttpRequest()) {
            $postArray = $request->request->all();

            $data = array();
            if (!empty($postArray['email'])) {
                $data['email'] = trim($postArray['email']);
            }

            $forgotResponse = $accountService->forgotpassword($data);

            if (!empty($forgotResponse['outcome']) && $forgotResponse['outcome'] == 'success') {
                $this->addFlash('info', "The reset password link was sent to " . $postArray['email']);
                return new JsonResponse(['result' => true]);
            } else {
                return new JsonResponse(['error' => $forgotResponse['data']]);
            }
        }

        return $this->render('Security/forgot-password.html.twig', [

        ]);
    }

    /**
     * @Route("/signout", methods={"GET"}, name="signout")
     */
    public function signout(AccountService $accountService)
    {
        $accountService->logout();

        $response = $this->redirectToRoute('homepage');
        $response->headers->clearCookie('scheduler_rememberme');

        return $response;
    }
}